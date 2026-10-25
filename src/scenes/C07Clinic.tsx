// C07 scene-based clinic: intake → limb tag → exams with tools → imaging →
// reasoning board → treatment decision. All rules come from the existing
// session engine (localisation, clue prerequisites, reasoning, four-category
// decisions); this file only maps tool actions onto them.

import { useCallback, useMemo, useState } from 'react';
import { caseById, cluesForCase, optionsForCase } from '../data';
import { CASE_META, LIMB_LABEL, type Limb } from '../data/caseMeta';
import {
  answerLocalization,
  answerQuiz,
  chooseOption,
  isLocalized,
  proceed,
  quizDone,
  quizQuestions,
  revealClue,
  type CaseSession,
  type DecisionFeedback,
} from '../engine/session';
import { ANSWER_LABEL } from '../types';
import { useStore } from '../store';
import { sound } from '../audio';
import { Flags, RefChips } from '../components/ui';
import { FractureXRay } from '../components/art/XRay';
import { PatientView, limbsFromSide, patientTargets } from '../components/PatientView';
import { nextPalpation, palpationTrigger, type PalpationEvent } from '../engine/palpation';
import { SCENE_SLOTS, sceneImage, type SceneSlotId } from './sceneAssets';
import { DOG_LIMBS, ExamRoom, ExamTable, Owner, SceneDog, Vet, limbLength, limbRotation } from './art';
import { DragGhost, TaskHint, ToolInfo, ToolTray, Zone, useFeedback, useTrayDrag, type ToolDef } from './ToolKit';
import { SceneShell, usePortrait } from './SceneShell';

const CASE = 'C07';
const W = 1600;
const H = 900;
const DESK_VB = `0 0 ${W} ${H}`;
const PORTRAIT_VB = '430 40 780 900';
/** Portrait phones get their own composition (not a shrunken desktop): everyone moves inside a narrow crop. */
const LAYOUT = {
  desk: { board: [930, 80], lightbox: [1260, 110], owner: 340, bubble: [410, 190], vet: 1340, dogFloor: [430, 400] },
  portrait: { board: [760, 60], lightbox: [460, 70], owner: 560, bubble: [600, 260], vet: 1260, dogFloor: [620, 400] },
};

const E = (n: number) => `${CASE}-E${n}`;

type Phase = 'intake' | 'localize' | 'exam' | 'reason' | 'decide';

export function phaseOf(s: CaseSession, heard: boolean): Phase {
  if (!heard) return 'intake';
  if (!isLocalized(s)) return 'localize';
  if ([1, 2, 3, 4].some((n) => !s.revealed.includes(E(n)))) return 'exam';
  if (!quizDone(s)) return 'reason';
  return 'decide';
}

export function sceneStageIndex(s: CaseSession, heard: boolean): number {
  const ph = phaseOf(s, heard);
  if (ph === 'intake') return 0;
  if (ph === 'localize') return 1;
  if (ph === 'exam') return s.revealed.includes(E(1)) && s.revealed.includes(E(2)) && !s.revealed.includes(E(3)) ? 2 : 1;
  return 3;
}

export function C07Clinic() {
  const { data, updateSession, reducedMotion } = useStore();
  const s = data.session!;
  const c = caseById(CASE)!;
  const meta = CASE_META[CASE];
  const clues = cluesForCase(CASE);
  // illustration feedback only: replays the withdrawal for a valid first palpation of this session
  const [palpation, setPalpation] = useState<PalpationEvent | null>(null);
  const portrait = usePortrait();
  const heard = (s.moduleState['scene:C07:heard'] as boolean | undefined) ?? false;
  const phase = phaseOf(s, heard);
  const { fb, say } = useFeedback();
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<'xray' | 'reason' | 'decide' | null>(null);
  const [walking, setWalking] = useState(false);
  const [pop, setPop] = useState<string | null>(null);
  const has = (n: number) => s.revealed.includes(E(n));
  const localized = isLocalized(s);

  const flash = (zone: string) => {
    setPop(zone);
    window.setTimeout(() => setPop((p) => (p === zone ? null : p)), 700);
  };
  const reveal = (n: number) => updateSession((x) => revealClue(x, E(n)));
  const result = (n: number) => clues.find((x) => x.id === E(n))!.result;

  const tools: ToolDef[] = [
    {
      id: 'chart',
      icon: 'chart',
      name: '問診紀錄',
      purpose: '向飼主詢問並記錄病史',
      where: '飼主',
      done: heard && has(4),
      locked: null,
    },
    {
      id: 'tag',
      icon: 'tag',
      name: '患肢標記',
      purpose: '把標記掛在你判斷的患肢上',
      where: '病患的四肢（病患面向你：病患左側在畫面右側，右側肢較深色）',
      locked: heard ? null : '先聽飼主說明主訴',
      done: localized,
    },
    {
      id: 'observe',
      icon: 'observe',
      name: '步態觀察',
      purpose: '觀察病患站立與步態（教學動畫）',
      where: '病患身體',
      locked: !localized ? '先標記患肢' : null,
      done: has(1),
    },
    {
      id: 'palpate',
      icon: 'palpate',
      name: '骨科觸診',
      purpose: '在患肢做一次輕柔觸診（簡化教學，不模擬觸診力道）',
      where: '已標記的患肢',
      locked: !has(1) ? '先完成步態觀察' : null,
      done: has(2),
    },
    {
      id: 'xray',
      icon: 'xray',
      name: 'X 光',
      purpose: '拍攝患肢正交影像（教學示意）',
      where: '已標記的患肢',
      locked: !has(1) ? '先完成步態觀察' : null,
      done: has(3),
    },
  ];
  const sel = tools.find((t) => t.id === selected) ?? null;

  const use = useCallback(
    (tool: string | null, zone: string) => {
      const limb = zone.startsWith('limb-') ? (zone.slice(5) as Limb) : null;
      const onDog = zone === 'dog' || !!limb;
      if (zone === 'board') {
        if (phase === 'reason' || phase === 'decide') return setPanel(phase === 'reason' ? 'reason' : 'decide');
        return say('info', '先完成所有檢查，再到推理白板整理判斷。');
      }
      if (zone === 'lightbox') {
        if (has(3)) return setPanel('xray');
        return say('info', '尚未拍攝 X 光。');
      }
      if (!tool) return say('info', '先從下方工具盤選一個工具（點選或拖曳）。');
      const t = tools.find((x) => x.id === tool)!;
      if (t.locked) return say('warn', `${t.name}還不能用：${t.locked}。`);
      switch (tool) {
        case 'chart':
          if (zone !== 'owner') return say('warn', '問診紀錄要用在飼主身上。');
          if (!heard) {
            updateSession((x) => ({ ...x, moduleState: { ...x.moduleState, 'scene:C07:heard': true } }));
            sound.play('reveal');
            flash('owner');
            return say('ok', `飼主：「${c.complaint}」`);
          }
          if (has(1) && !has(4)) {
            reveal(4);
            sound.play('reveal');
            flash('owner');
            return say('ok', `補充資訊：${result(4)}`);
          }
          return say('info', has(4) ? '飼主能提供的資訊都已記錄（在「病歷與資料」可重讀）。' : '先觀察步態，再向飼主詢問補充資訊。');
        case 'tag': {
          if (!limb) return say('warn', '患肢標記要掛在四肢上。');
          if (localized) return say('info', '患肢已經標記完成。');
          const r = answerLocalization(s, [limb]);
          updateSession(() => r.session);
          if (r.correct) {
            sound.play('success');
            flash(zone);
            setSelected(null);
            return say('ok', `已標記${LIMB_LABEL[limb]}。檢查工具已解鎖。`);
          }
          sound.play('warn');
          return say('warn', `${LIMB_LABEL[limb]}不是患肢（已記錄首次作答）。重讀主訴，並注意病患面向你：病患左側在畫面右側。`);
        }
        case 'observe':
          if (!onDog) return say('warn', '步態觀察要對著病患使用。');
          if (has(1)) return say('info', '步態已觀察過，可在病歷重讀。');
          reveal(1);
          setWalking(true);
          window.setTimeout(() => setWalking(false), 1600);
          sound.play('reveal');
          flash('dog');
          return say('ok', `步態：${result(1)}`);
        case 'palpate':
          if (!limb) return say('warn', '觸診要放在肢體上。');
          if (limb !== 'LF') return say('warn', `${LIMB_LABEL[limb]}不是已標記的患肢；觸診集中在患肢一次即可，不需重複碰觸。`);
          if (has(2)) return say('info', '已完成觸診；不需要重複碰觸疼痛部位。');
          setPalpation((prev) => nextPalpation(prev, s, clues.find((x) => x.id === E(2))!));
          reveal(2);
          sound.play('reveal');
          flash(zone);
          return say('ok', `觸診：${result(2)}`);
        case 'xray':
          if (!limb) return say('warn', 'X 光要對準肢體。');
          if (limb !== 'LF') return say('warn', `${LIMB_LABEL[limb]}不是患肢；請對準已標記的左前肢。`);
          if (has(3)) {
            setPanel('xray');
            return say('info', '已拍攝，重新開啟影像。');
          }
          reveal(3);
          sound.play('reveal');
          flash(zone);
          setPanel('xray');
          return say('ok', `X 光：${result(3)}`);
      }
    },
    [phase, heard, localized, s, tools, c.complaint, say, updateSession], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onDrop = useCallback((tool: string, zone: string) => use(tool, zone), [use]);
  const onTap = useCallback((tool: string) => {
    sound.play('click');
    setSelected((cur) => (cur === tool ? null : tool));
  }, []);
  const { drag, begin } = useTrayDrag(onDrop, onTap);
  const hover = drag?.zone ?? null;

  const task = useMemo(() => {
    if (phase === 'intake') return '拿起「問診紀錄」，用在飼主身上聽主訴。';
    if (phase === 'localize') return '拿起「患肢標記」，掛在你判斷的患肢上。';
    if (phase === 'exam') {
      if (!has(1)) return '用「步態觀察」看看病患怎麼站、怎麼走。';
      if (!has(2)) return '用「骨科觸診」在患肢做一次觸診。';
      if (!has(3)) return '用「X 光」對準患肢拍攝正交影像。';
      return '再用「問診紀錄」向飼主詢問補充資訊。';
    }
    if (phase === 'reason') return '點牆上的「推理白板」，回答三個判斷。';
    return '點推理白板，選擇處置。';
  }, [phase, s.revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  const zp = { selected, hover, onUse: (z: string) => use(selected, z) };
  const dogOnTable = heard;
  const dogScale = 1.25;
  const lay = portrait ? LAYOUT.portrait : LAYOUT.desk;

  return (
    <SceneShell
      stageIndex={sceneStageIndex(s, heard)}
      patient={
        <span className="patient-chip" data-testid="patient-chip">
          <b>{meta.name}</b>・{c.species}・{c.breed}・{c.ageMonths} 月齡・{c.weightKg} kg・患側：{localized ? c.side : '待定位'}
          <span className="tag fiction">虛構教學病例</span>
        </span>
      }
      hint={<TaskHint text={task} fb={fb} />}
      toolInfo={<ToolInfo tool={sel} />}
      tray={<ToolTray tools={tools} selected={selected} onSelect={onTap} begin={begin} />}
      drawer={<ClinicDrawer />}
    >
      <svg
        className="scene-svg"
        viewBox={portrait ? PORTRAIT_VB : DESK_VB}
        preserveAspectRatio="xMidYMid meet"
        role="application"
        aria-label="診間場景：用工具盤的工具在飼主或病患身上操作"
        data-testid="clinic-stage"
        data-phase={phase}
      >
        {/* layer 1: room (PNG when delivered, otherwise the vector room) */}
        <g data-layer="background">
          <SlotImage id="background" fallback={<ExamRoom w={W} h={H} />} />
        </g>
        {/* wall props that are also targets (program-drawn, never baked into the room image) */}
        <g data-layer="props">
        {/* reasoning whiteboard */}
        <Zone id="board" label="推理白板" accepts={[]} {...zp} onUse={() => use(null, 'board')} inactive={phase !== 'reason' && phase !== 'decide'} pop={pop === 'board'}>
          <g transform={`translate(${lay.board[0]} ${lay.board[1]})`}>
            <rect width="300" height="180" rx="14" fill="#FFFFFF" stroke={phase === 'reason' || phase === 'decide' ? '#3A9E94' : '#C9C2B6'} strokeWidth="6" className={phase === 'reason' || phase === 'decide' ? 'glow' : ''} />
            <text x="150" y="50" textAnchor="middle" fontSize="30" fontWeight="700" fill="#3F3A36">推理白板</text>
            <path d="M40 90 h220 M40 120 h180 M40 150 h140" stroke="#CBD5E1" strokeWidth="8" strokeLinecap="round" />
            {(phase === 'reason' || phase === 'decide') && <text x="150" y="172" textAnchor="middle" fontSize="20" fill="#2C7A72">點我開始</text>}
          </g>
        </Zone>
        {/* lightbox appears after the X-ray */}
        {has(3) && (
          <Zone id="lightbox" label="X 光看片燈箱" accepts={[]} {...zp} onUse={() => use(null, 'lightbox')}>
            <g transform={`translate(${lay.lightbox[0]} ${lay.lightbox[1]})`}>
              <rect width="200" height="140" rx="10" fill="#0B1924" stroke="#334155" strokeWidth="6" />
              <path d="M30 70 h80 l10 -8 h50" stroke="#E2EDF8" strokeWidth="12" strokeLinecap="round" fill="none" />
              <text x="100" y="128" textAnchor="middle" fontSize="18" fill="#94A3B8">教學示意・點我看片</text>
            </g>
          </Zone>
        )}
        </g>
        {/* layer 2: people behind the table */}
        <g data-layer="people">
          <g className="enter-left">
            <SlotImage id="owner" fallback={<Owner x={lay.owner} y={290} talking={phase === 'intake'} />} dx={lay.owner - 340} />
          </g>
          <SlotImage id="vet" fallback={<Vet x={lay.vet} y={290} wave={phase === 'decide'} />} dx={lay.vet - 1340} />
        </g>
        {/* layer 3: exam table */}
        <g data-layer="table">
          <SlotImage id="table" fallback={<ExamTable x={540} y={520} w={600} />} />
        </g>
        {/* layer 6: interaction targets (transparent, scene coordinates) */}
        <g data-layer="interaction">
          <Zone id="owner" label="飼主" accepts={['chart']} {...zp} pop={pop === 'owner'}>
            <rect className="limb-outline" x={lay.owner - 100} y="270" width="200" height="420" rx="40" />
          </Zone>
        </g>
        {!heard && (
          <g className="bubble" transform={`translate(${lay.bubble[0]} ${lay.bubble[1]})`}>
            <rect width="440" height="104" rx="22" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="3" />
            <path d="M40 104 l-20 34 l50 -34 z" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="3" />
            <text x="24" y="44" fontSize="26" fill="#0F172A">醫師，雪球從沙發跳下來後</text>
            <text x="24" y="80" fontSize="26" fill="#0F172A">左前腳就不敢踩了…</text>
          </g>
        )}
        {/* layers 4–5: patient + contact shadow, with its own limb targets on top */}
        <g data-layer="patient">
        {/* on the table: the seated patient illustration with tool targets laid over it */}
        {/* kept mounted (only hidden) during the gait walk so its animations never restart */}
        {dogOnTable && (
          <TablePatient
            hidden={walking}
            zp={zp}
            pop={pop}
            localized={localized}
            trigger={palpationTrigger(palpation, s.eventId)}
            reducedMotion={reducedMotion}
          />
        )}
        {/* dog: walks in on the floor; the side view is also used for the gait observation */}
        {(!dogOnTable || walking) && <g className="dog-move" style={{ transform: dogOnTable ? `translate(600px, ${520 - 229 * dogScale}px)` : `translate(${lay.dogFloor[0]}px, ${lay.dogFloor[1]}px)` }}>
          <g className={!heard ? 'enter-left' : undefined}>
            <SceneDog x={0} y={0} scale={dogOnTable ? dogScale : 1} lifted="LF" walking={walking} limbOverlay={(l) => (localized && l === 'LF' ? <TagMark /> : null)} />
            {/* zones drawn on top of the art so they receive input; limbs last so they win over the body */}
            <Zone id="dog" label="病患身體" accepts={['observe']} {...zp} pop={pop === 'dog'} inactive={!dogOnTable}>
              <ellipse className="limb-outline" cx={172 * (dogOnTable ? dogScale : 1)} cy={100 * (dogOnTable ? dogScale : 1)} rx={120 * (dogOnTable ? dogScale : 1)} ry={52 * (dogOnTable ? dogScale : 1)} />
            </Zone>
            {/* limb zones drawn on top so they win hit-testing */}
            {dogOnTable && <LimbZones zp={zp} scale={dogScale} pop={pop} localized={localized} />}
          </g>
        </g>}
        </g>
      </svg>
      <DragGhost drag={drag} tools={tools} />
      {panel === 'xray' && (
        <Overlay title="X 光（教學示意，非臨床影像）" onClose={() => setPanel(null)}>
          <FractureXRay caseId={CASE} />
          <p className="small">{result(3)}</p>
        </Overlay>
      )}
      {panel === 'reason' && <ReasonPanel onClose={() => setPanel(null)} onDone={() => setPanel('decide')} />}
      {panel === 'decide' && <DecisionPanel onClose={() => setPanel(null)} />}
    </SceneShell>
  );
}

/** A scene layer: the delivered PNG in its scene box, or the vector fallback. `dx` shifts the box for the portrait layout. */
function SlotImage({ id, fallback, dx = 0 }: { id: SceneSlotId; fallback: React.ReactNode; dx?: number }) {
  const url = sceneImage(id);
  if (!url) return <g data-art="vector" data-slot={id}>{fallback}</g>;
  const r = SCENE_SLOTS[id].rect;
  return <image href={url} x={r.x + dx} y={r.y} width={r.width} height={r.height} preserveAspectRatio="xMidYMax meet" data-art="raster" data-slot={id} />;
}

const LIMBS: Limb[] = ['RH', 'LH', 'RF', 'LF']; // forelimbs last so they win overlapping hits
// scene units: paws on the table top (y 520), clear of the whiteboard on the right
const PV = { x: 610, y: 109, size: 420 };

/** The seated patient (PatientView) on the table, with body and per-limb tool targets on top. */
function TablePatient({ hidden, zp, pop, localized, trigger, reducedMotion }: { hidden: boolean; zp: { selected: string | null; hover: string | null; onUse: (z: string) => void }; pop: string | null; localized: boolean; trigger: number; reducedMotion: boolean }) {
  const c = caseById(CASE)!;
  const affected = limbsFromSide(c.side);
  // the same boxes PatientView draws with (raster manifest or vector geometry), in its viewBox units
  const targets = patientTargets(c.species, c.breed, c.pose, affected);
  const k = PV.size / 340;
  return (
    <g data-testid="table-patient" className="fade-in" style={hidden ? { opacity: 0, pointerEvents: 'none' } : undefined} aria-hidden={hidden || undefined}>
      <PatientView
        nested={{ x: PV.x, y: PV.y }}
        size={PV.size}
        species={c.species}
        breed={c.breed}
        pose={c.pose}
        affectedLimbs={affected}
        palpationTrigger={trigger}
        reducedMotion={reducedMotion}
        limbOverlay={(l) => (localized && l === 'LF' ? <TagMark x={214} y={236} /> : null)}
      />
      <g transform={`translate(${PV.x} ${PV.y}) scale(${k})`}>
        <Zone id="dog" label="病患身體" accepts={['observe']} {...zp} pop={pop === 'dog'}>
          <rect className="limb-outline" {...targets.body} rx="64" />
        </Zone>
        {LIMBS.map((l) => (
          <Zone
            key={l}
            id={`limb-${l}`}
            label={`${LIMB_LABEL[l]}（畫面${l.startsWith('L') ? '右' : '左'}側）`}
            accepts={['tag', 'palpate', 'xray', 'observe']}
            {...zp}
            pop={pop === `limb-${l}`}
            done={localized && l === 'LF'}
          >
            <rect className="limb-outline" {...targets.limbs[l]} rx="22" />
          </Zone>
        ))}
      </g>
    </g>
  );
}

function TagMark({ x = 250, y = 186 }: { x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0 L22 -10 L40 8 L18 28 Z" fill="#FB923C" stroke="#C2410C" strokeWidth="3" />
      <circle cx="22" cy="0" r="4" fill="#FFF7ED" />
    </g>
  );
}

/** Transparent, enlarged limb hit areas in scene space, matching the SceneDog geometry. */
function LimbZones({ zp, scale, pop, localized }: { zp: { selected: string | null; hover: string | null; onUse: (z: string) => void }; scale: number; pop: string | null; localized: boolean }) {
  // same geometry as SceneDog, with a generous margin; LF is the lifted limb in C07
  return (
    <g transform={`scale(${scale})`}>
      {DOG_LIMBS.map((l) => (
        <Zone
          key={l.id}
          id={`limb-${l.id}`}
          label={`${LIMB_LABEL[l.id]}${l.far ? '（後方、較深色）' : '（前方）'}`}
          accepts={['tag', 'palpate', 'xray', 'observe']}
          {...zp}
          pop={pop === `limb-${l.id}`}
          done={localized && l.id === 'LF'}
        >
          <g transform={`rotate(${limbRotation(l.id, 'LF')} ${l.ax} ${l.ay})`}>
            <rect className="limb-outline" x={l.ax - 24} y={l.ay - 2} width="48" height={limbLength(l) + 22} rx="22" />
          </g>
        </Zone>
      ))}
    </g>
  );
}

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="scene-overlay" role="dialog" aria-label={title} data-testid="scene-overlay">
      <div className="scene-overlay-box">
        <div className="row">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <span className="spacer" />
          <button className="btn sm" onClick={onClose} data-testid="overlay-close">
            關閉 ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ReasonPanel({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data, updateSession } = useStore();
  const s = data.session!;
  const qs = quizQuestions(s);
  const solved = (id: string) => qs.find((q) => q.id === id)!.options.some((o) => o.correct && o.id === s.quiz?.answers[id]);
  const idx = qs.findIndex((q) => !solved(q.id));
  const [lastWhy, setLastWhy] = useState<{ ok: boolean; text: string } | null>(null);
  if (idx === -1) {
    return (
      <Overlay title="推理白板" onClose={onClose}>
        <p>三個判斷都完成了。</p>
        <button className="btn accent lg" onClick={onDone} data-testid="to-decision">
          選擇處置 →
        </button>
      </Overlay>
    );
  }
  const q = qs[idx];
  return (
    <Overlay title={`推理白板（${idx + 1}/${qs.length}）`} onClose={onClose}>
      <p style={{ fontSize: '1.1rem', margin: '4px 0' }}>
        <b>{q.prompt}</b>
      </p>
      <div className="quiz-opts">
        {q.options.map((o) => (
          <button
            key={o.id}
            className="quiz-opt"
            onClick={() => {
              const r = answerQuiz(s, q.id, o.id);
              updateSession(() => r.session);
              sound.play(r.correct ? 'success' : 'warn');
              setLastWhy({ ok: r.correct, text: o.why });
            }}
            data-testid={`quiz-${q.id}-${o.id}`}
            data-correct={o.correct ? 'y' : 'n'}
          >
            {o.text}
          </button>
        ))}
      </div>
      {lastWhy && (
        <p className={`small task-fb ${lastWhy.ok ? 'ok' : 'warn'}`}>
          {lastWhy.ok ? '✓ ' : '△ 再想想：'}
          {lastWhy.text}
        </p>
      )}
      <p className="small muted">依據：{q.basis.join('、')}・首次作答會記錄。</p>
    </Overlay>
  );
}

const VERDICT_ICON = { preferred: '★', alternative: '✓', insufficient: '？', unsuitable: '✕', 'missing-clues': '？' } as const;

function DecisionPanel({ onClose }: { onClose: () => void }) {
  const { data, updateSession } = useStore();
  const s = data.session!;
  const options = optionsForCase(CASE);
  const [fb, setFb] = useState<DecisionFeedback | null>(null);
  const o = fb?.option;
  return (
    <Overlay title="處置判斷" onClose={onClose}>
      {!fb ? (
        <div className="decision-cards">
          {options.map((x) => (
            <button
              key={x.id}
              className="decision-card"
              onClick={() => {
                const r = chooseOption(s, x.id);
                updateSession(() => r.session);
                sound.play('click');
                setFb(r.feedback);
              }}
              data-testid={`option-${x.id}`}
            >
              {x.name}
            </button>
          ))}
        </div>
      ) : (
        <div className={`verdict ${fb.outcome}`} data-testid="verdict" data-outcome={fb.outcome}>
          <div className="title">
            <span aria-hidden>{VERDICT_ICON[fb.outcome]}</span>
            {fb.outcome === 'missing-clues' ? '條件不足（前置步驟未完成）' : ANSWER_LABEL[fb.outcome]}
          </div>
          <p style={{ margin: '6px 0' }}>{o!.name}</p>
          {fb.outcome === 'alternative' && <p className="small"><b>合理替代，不是醫療錯誤。</b></p>}
          {fb.outcome === 'insufficient' && <p className="small"><b>不計分，也不是 0 分。</b>還需要：{o!.missingInfo.join('；')}</p>}
          <p className="small">{o!.feedback}</p>
          <details className="small">
            <summary>詳細與來源</summary>
            <p>必要條件：{o!.requiredConditions}</p>
            <p>{fb.counted ? `本題教學評分（首次計分作答）：${o!.score}/10，不代表治療成功率。` : o!.score === null ? '本選項不計分（空白，不是 0 分）。' : '首次計分作答已記錄，改選不重複計分。'}</p>
            <Flags flags={o!.reviewFlags} />
            <RefChips ids={[...o!.referenceIds, o!.scoreSourceId].filter(Boolean)} />
          </details>
          <div className="row" style={{ marginTop: 8 }}>
            {o!.route.kind === 'module' && (
              <button className="btn accent lg" onClick={() => updateSession(proceed)} data-testid="proceed">
                前往手術室 →
              </button>
            )}
            <button className="btn" onClick={() => setFb(null)} data-testid="reselect">
              {o!.route.kind === 'retry' ? '改選其他處置' : '先不進行，改選'}
            </button>
          </div>
        </div>
      )}
    </Overlay>
  );
}

/** Case record, teaching notes and sources: read on demand. */
export function ClinicDrawer() {
  const { data } = useStore();
  const s = data.session!;
  const c = caseById(s.caseId)!;
  const clues = cluesForCase(s.caseId).filter((x) => s.revealed.includes(x.id));
  return (
    <div className="stack">
      <h3>病歷紀錄</h3>
      {clues.length === 0 ? (
        <p className="muted small">尚無檢查結果。</p>
      ) : (
        <ul className="record">
          {clues.map((x) => (
            <li key={x.id} data-testid={`record-${x.id}`}>
              <div className="h">
                {x.examName} <span className="tag">{x.id}</span>
              </div>
              <div>{x.result}</div>
              <Flags flags={x.reviewFlags} />
              <RefChips ids={x.referenceIds} />
            </li>
          ))}
        </ul>
      )}
      <h3>病患</h3>
      <p className="small">
        {c.species}・{c.breed}・{c.ageMonths} 月齡・{c.weightKg} kg・BCS {c.bcs9}/9
        <br />
        全身狀態：{c.systemicStatus}
        <br />
        <span className="muted">病患名字為遊戲設定；本病例是教學設定，不是真實臨床紀錄。</span>
      </p>
      <h3>文獻</h3>
      <RefChips ids={c.referenceIds} />
      <p className="small muted">檢查動作為簡化教學動畫，不模擬真實觸診力道或診斷能力。</p>
    </div>
  );
}
