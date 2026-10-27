import { useId, useState, type ReactNode } from 'react';
import { illust } from '../illustrations';
import { FRACTURE_MODELS, plateLength, type FractureModel, type ViewKey } from '../../config/fractureCases';
import { canalPath, distalPath, plateProfilePath, proximalPath } from './boneShapes';
import { evaluateHole, fractureSegment, holeX, plateById, topAt, type T09State } from '../../engine/t09';

// High-contrast grayscale TEACHING schematics. Not clinical images, not DICOM.
// 1 SVG unit = 1 model mm, so the 10 mm calibration bar is exact in model scale.

const BONE = 'url(#xrBone)';

function Defs() {
  return (
    <defs>
      <linearGradient id="xrBone" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#CBD5E1" />
        <stop offset=".5" stopColor="#F8FAFC" />
        <stop offset="1" stopColor="#CBD5E1" />
      </linearGradient>
      <radialGradient id="xrSoft" cx=".5" cy=".5" r=".6">
        <stop offset="0" stopColor="#475569" stopOpacity=".55" />
        <stop offset="1" stopColor="#1E293B" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

function Frame({ w, h, projection, marker, markerX = 4, children, note }: { w: number; h: number; projection: string; marker: string; markerX?: number; children: ReactNode; note?: string }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`教學示意 X 光：${projection}，側標 ${marker}`}>
      <Defs />
      <rect width={w} height={h} fill="#000" />
      {children}
      <text x={w - 2} y={4.5} fill="#E2E8F0" fontSize="3.2" textAnchor="end">教學示意・非臨床影像（非 DICOM）</text>
      <text x={2} y={4.5} fill="#E2E8F0" fontSize="3.2">{projection}</text>
      <g>
        <rect x={markerX} y={h - 14} width="7" height="7" fill="#F8FAFC" />
        <text x={markerX + 3.5} y={h - 8.6} fontSize="5.5" textAnchor="middle" fontWeight="700" fill="#000">{marker}</text>
      </g>
      <ScaleBar x={w - 16} y={h - 6} />
      {note && <text x={w / 2} y={h - 2} fill="#94A3B8" fontSize="2.6" textAnchor="middle">{note}</text>}
    </svg>
  );
}

function ScaleBar({ x, y }: { x: number; y: number }) {
  return (
    <g aria-label="10 mm 校準標尺（模型比例）">
      <line x1={x} y1={y} x2={x + 10} y2={y} stroke="#F8FAFC" strokeWidth=".6" />
      {[0, 5, 10].map((t) => <line key={t} x1={x + t} y1={y - 1.2} x2={x + t} y2={y + 0.4} stroke="#F8FAFC" strokeWidth=".4" />)}
      <text x={x + 5} y={y - 1.8} fontSize="2.4" fill="#F8FAFC" textAnchor="middle">10 mm</text>
    </g>
  );
}

// ---------- fracture (shared model with T09) ----------
//
// Operative views (xray = false) use the painted bone and implant art when it has been
// delivered: the painting is only a texture clipped to the model outline, so the outline,
// fracture line, hole positions and screw lengths that the scoring uses stay exactly the
// model's. X-ray schematics never use the paintings.

/**
 * Two half-planes split along the (extended) fracture line: the painted bone is shown
 * whole, only cut where it is broken, never trimmed to another outline.
 */
function fractureHalves(m: FractureModel): { proximal: string; distal: string } {
  const fs = fractureSegment(m);
  const R = 60; // well beyond any bone edge
  const dxdy = (fs.b.x - fs.a.x) / (fs.b.y - fs.a.y || 1);
  const xTop = fs.a.x + dxdy * (-R - fs.a.y);
  const xBot = fs.a.x + dxdy * (R - fs.a.y);
  return {
    proximal: `M${-R} ${-R} L${xTop} ${-R} L${xBot} ${R} L${-R} ${R} Z`,
    distal: `M${xTop} ${-R} L${m.length + R} ${-R} L${m.length + R} ${R} L${xBot} ${R} Z`,
  };
}

export function FractureBones({ m, s, view, xray = true }: { m: FractureModel; s: Pick<T09State, 'dx' | 'views'>; view: ViewKey; xray?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const painted = xray || !m.outline ? null : illust(`surgery/${m.caseId}-bone`);
  if (painted) return <PaintedBones m={m} s={s} view={view} art={painted} uid={uid} />;
  const pose = s.views[view];
  const fill = xray ? BONE : 'url(#opBone)';
  const stroke = xray ? '#F8FAFC' : '#E2EDF8';
  const canal = xray ? '#64748B' : '#9FB6CC';
  const t = `translate(${s.dx} ${pose.dy}) rotate(${pose.theta} ${m.fracture.x} 0)`;
  return (
    <g>
      {m.companion && view === 'primary' && (
        <g opacity=".75">
          <rect x={2} y={m.companion.offsetY - m.companion.width / 2} width={m.fracture.x + 1} height={m.companion.width} rx="1.5" fill={fill} stroke={stroke} strokeWidth=".2" />
          <g transform={t}>
            <rect x={m.fracture.x + 2} y={m.companion.offsetY - m.companion.width / 2} width={m.length - m.fracture.x - 2} height={m.companion.width} rx="1.5" fill={fill} stroke={stroke} strokeWidth=".2" />
          </g>
        </g>
      )}
      <path d={proximalPath(m)} fill={fill} stroke={stroke} strokeWidth=".3" />
      <path d={canalPath(m, 'proximal')} fill={canal} opacity=".55" />
      <g transform={t} data-testid={`fragment-${view}`}>
        <path d={distalPath(m)} fill={fill} stroke={stroke} strokeWidth=".3" />
        <path d={canalPath(m, 'distal')} fill={canal} opacity=".55" />
      </g>
    </g>
  );
}

function PaintedBones({ m, s, view, art, uid }: { m: FractureModel; s: Pick<T09State, 'dx' | 'views'>; view: ViewKey; art: string; uid: string }) {
  const pose = s.views[view];
  const t = `translate(${s.dx} ${pose.dy}) rotate(${pose.theta} ${m.fracture.x} 0)`;
  const halves = fractureHalves(m);
  const o = m.outline!;
  const companionArt = o.companion ? illust(`surgery/${m.caseId}-ulna`) : null;
  // the model outline is traced from this same painting, so the image is drawn at its own size
  const paint = (href: string, p: { y: number; height: number }, half: 'p' | 'd') => (
    <image href={href} x={0} y={p.y} width={m.length} height={p.height} preserveAspectRatio="none" clipPath={`url(#${uid}-${half})`} />
  );
  return (
    <g data-art="painted">
      <defs>
        <clipPath id={`${uid}-p`}>
          <path d={halves.proximal} />
        </clipPath>
        <clipPath id={`${uid}-d`}>
          <path d={halves.distal} />
        </clipPath>
      </defs>
      {companionArt && o.companion && view === 'primary' && (
        <g opacity=".85">
          {paint(companionArt, o.companion.paint, 'p')}
          <g transform={t}>{paint(companionArt, o.companion.paint, 'd')}</g>
        </g>
      )}
      {paint(art, o.paint, 'p')}
      <g transform={t} data-testid={`fragment-${view}`}>
        {paint(art, o.paint, 'd')}
      </g>
    </g>
  );
}

/**
 * Painted face-on look of a hole marker (the numbered row above the plate): an empty plate
 * hole, or a screw head once locked. The status ring drawn on top keeps the colour code.
 */
export function HoleSprite({ x, y, r, locked }: { x: number; y: number; r: number; locked: boolean }) {
  const art = illust(locked ? 'surgery/screw-head' : 'surgery/hole');
  if (!art) return null;
  return <image href={art} x={x - r} y={y - r} width={r * 2} height={r * 2} pointerEvents="none" />;
}

export const PLATE_THICKNESS: Record<string, number> = { C07: 1.1, C08: 1.5 };

/** Plate + locked screws for any view; distal screws ride with the distal fragment. */
export function Implants({ m, s, view, xray = true }: { m: FractureModel; s: T09State; view: ViewKey; xray?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const plate = plateById(m, s.plate.plateId);
  if (!plate || s.plate.side === null) return null;
  const len = plateLength(plate);
  const face = m.views[view].plateFace === 'face';
  const th = PLATE_THICKNESS[m.caseId] ?? 1.2;
  const pose = s.views[view];
  const t = `translate(${s.dx} ${pose.dy}) rotate(${pose.theta} ${m.fracture.x} 0)`;
  const screws = Object.entries(s.holes)
    .filter(([, h]) => h.status === 'locked')
    .map(([k, h]) => ({ k, h, e: evaluateHole(m, s, Number(k), h.length) }));
  const metal = xray ? '#FFFFFF' : 'url(#opScrew)';
  const art = xray
    ? null
    : { plate: illust('surgery/plate'), hole: illust('surgery/hole'), head: illust('surgery/screw-head'), side: illust('surgery/screw-side') };
  const plateFill = xray ? '#E5E7EB' : art?.plate ? `url(#${uid}-steel)` : 'url(#opPlate)';
  const glyph = (lx: number, length: number, key: string) =>
    art?.head && face ? (
      <image key={key} href={art.head} x={lx - 1.25} y={-1.25} width={2.5} height={2.5} />
    ) : art?.side && !face ? (
      // the shaft is stretched to the chosen length; the head sits on the plate exactly like the drawn screw
      <image key={key} href={art.side} x={lx - 0.7} y={topAt(m, lx) - th * 0.6} width={1.4} height={length + th * 0.6} preserveAspectRatio="none" />
    ) : face ? (
      <circle key={key} cx={lx} cy={0} r={1.1} fill={metal} stroke={xray ? 'none' : '#FACC15'} strokeWidth=".3" />
    ) : (
      <rect key={key} x={lx - 0.5} y={topAt(m, lx) - th * 0.6} width={1} height={length + th * 0.6} rx=".3" fill={metal} />
    );
  return (
    <g opacity={xray ? 0.95 : 1}>
      {art?.plate && (
        <defs>
          <pattern id={`${uid}-steel`} patternUnits="userSpaceOnUse" width="24" height="6">
            <image href={art.plate} width="24" height="6" preserveAspectRatio="none" />
          </pattern>
        </defs>
      )}
      {face ? (
        <>
          <rect x={s.plate.x} y={-2} width={len} height={4} rx="1.4" fill={plateFill} opacity={xray ? 0.7 : art?.plate ? 1 : 0.85} stroke={art?.plate ? '#7C8792' : undefined} strokeWidth=".2" />
          {/* hole sprites at the model's hole positions (the same x the drilling and scoring use) */}
          {art?.hole &&
            Array.from({ length: plate.holes }, (_, i) => holeX(m, s, i))
              .filter((x): x is number => x !== null)
              .map((x, i) => <image key={`h${i}`} href={art.hole!} x={x - 1.3} y={-1.3} width={2.6} height={2.6} />)}
        </>
      ) : (
        <path d={plateProfilePath(m, s.plate.x, len, th, s.plate.side === 'tension' ? 'top' : 'bottom')} fill={xray ? '#F1F5F9' : plateFill} stroke={art?.plate ? '#6B7680' : undefined} strokeWidth=".12" />
      )}
      {screws.filter((x) => x.e.fragment !== 'distal').map((x) => glyph(x.e.localX, x.h.length ?? 0, x.k))}
      <g transform={t}>{screws.filter((x) => x.e.fragment === 'distal').map((x) => glyph(x.e.localX, x.h.length ?? 0, x.k))}</g>
    </g>
  );
}

export function FractureXRay({ caseId, state, showImplants = false, only }: { caseId: string; state?: T09State; showImplants?: boolean; only?: ViewKey }) {
  const m = FRACTURE_MODELS[caseId];
  const s = state ?? { dx: m.initial.dx, views: m.initial.views };
  const w = m.length + 30;
  const h = 46;
  return (
    <div className={only ? '' : 'grid cols-2'} style={{ gap: 8 }}>
      {(only ? [only] : (['primary', 'secondary'] as ViewKey[])).map((view) => (
        <div className="xray" key={view}>
          <Frame w={w} h={h} projection={`${m.views[view].label}・${m.boneName}`} marker={m.sideLabel} note="2D 示意：兩視角共用同一份模型狀態">
            <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2.6} fill="url(#xrSoft)" />
            <g transform={`translate(15 ${h / 2})`}>
              <FractureBones m={m} s={s} view={view} />
              {showImplants && state && <Implants m={m} s={state} view={view} />}
            </g>
          </Frame>
        </div>
      ))}
    </div>
  );
}

// ---------- non-fracture teaching schematics ----------
function StifleLateral({ caseId }: { caseId: 'C01' | 'C02' }) {
  const tpa = caseId === 'C01' ? 27 : 32; // values from C01-E3 / C02-E3
  const r = (tpa * Math.PI) / 180;
  const [cx, cy] = [62, 46];
  return (
    <Frame w={120} h={90} projection="Lat 側位・左膝" marker="L" note="TPA 數值取自病例 X 光判讀文字">
      <ellipse cx="60" cy="45" rx="42" ry="30" fill="url(#xrSoft)" />
      {/* effusion haze */}
      <ellipse cx="60" cy="44" rx="16" ry="10" fill="#94A3B8" opacity=".25" />
      {/* femur */}
      <path d="M30 6 L44 6 L52 30 Q66 30 70 38 Q60 46 48 42 Q40 36 36 22 Z" fill={BONE} />
      {/* patella */}
      <ellipse cx="74" cy="30" rx="4" ry="6" fill={BONE} transform="rotate(-20 74 30)" />
      {/* tibia */}
      <path d="M46 48 Q62 44 76 48 L72 56 Q66 60 64 70 L60 86 L50 86 L52 64 Q46 56 46 48 Z" fill={BONE} />
      {caseId === 'C01' && <path d="M45 47 l-3 -2 M77 48 l3 -2" stroke="#F8FAFC" strokeWidth="1" />}
      {/* tibial plateau line and functional axis */}
      <line x1={cx - 16 * Math.cos(r)} y1={cy + 16 * Math.sin(r) - 2} x2={cx + 16 * Math.cos(r)} y2={cy - 16 * Math.sin(r) - 2} stroke="#38BDF8" strokeWidth=".7" strokeDasharray="2 1" />
      <line x1={cx - 6} y1={cy - 6} x2={cx - 4} y2={cy + 38} stroke="#38BDF8" strokeWidth=".5" strokeDasharray="1 1" />
      <text x="84" y="40" fontSize="4" fill="#38BDF8">TPA {tpa}°</text>
      <text x="84" y="46" fontSize="2.8" fill="#94A3B8">（依 {caseId}-E3）</text>
    </Frame>
  );
}

function HipVD({ bilateral }: { bilateral: boolean }) {
  // VD convention: patient's right is on the viewer's left; marker placed on that side
  return (
    <Frame w={120} h={90} projection="VD 腹背位・骨盆與髖" marker="R" markerX={4} note={bilateral ? '雙側退化影像：須與症狀及功能整合' : '右側股骨頭變形塌陷'}>
      <ellipse cx="60" cy="45" rx="50" ry="36" fill="url(#xrSoft)" />
      <path d="M40 10 Q60 4 80 10 L84 34 Q76 44 60 46 Q44 44 36 34 Z" fill={BONE} opacity=".9" />
      <rect x="56" y="4" width="8" height="22" rx="3" fill={BONE} />
      {[{ x: 34, right: true }, { x: 86, right: false }].map(({ x, right }) => {
        const abnormal = right || bilateral;
        const dir = right ? -1 : 1;
        return (
          <g key={x}>
            {/* acetabulum rim */}
            <path d={`M${x - 7} 30 Q${x} 22 ${x + 7} 30`} stroke="#F8FAFC" strokeWidth="1.2" fill="none" />
            {/* femoral head */}
            {abnormal && right && !bilateral ? (
              <path d={`M${x - 6} 33 Q${x - 2} 27 ${x + 4} 30 L${x + 6} 36 Q${x} 39 ${x - 6} 37 Z`} fill="#CBD5E1" stroke="#94A3B8" strokeWidth=".5" />
            ) : (
              <circle cx={x} cy={33} r={6} fill={BONE} />
            )}
            {abnormal && bilateral && <path d={`M${x - 7} 29 l-2 -2 M${x + 7} 29 l2 -2`} stroke="#F8FAFC" strokeWidth="1" />}
            {/* neck + femur */}
            <path d={`M${x} 36 L${x + dir * -2} 44 L${x + dir * -3} 86 L${x + dir * 5} 86 L${x + dir * 5} 44 Z`} fill={BONE} />
            <circle cx={x + dir * 8} cy={40} r={3.5} fill={BONE} />
          </g>
        );
      })}
    </Frame>
  );
}

function StifleCrCd({ caseId }: { caseId: 'C04' | 'C05' }) {
  const right = caseId === 'C04';
  // in a CrCd view the limb's medial side faces the midline; label it explicitly
  const medialOnRight = right;
  const shift = caseId === 'C04' ? (medialOnRight ? 10 : -10) : 0;
  return (
    <Frame w={120} h={90} projection={`CrCd 前後位・${right ? '右' : '左'}膝`} marker={right ? 'R' : 'L'} note={caseId === 'C04' ? '伸膝機制排列異常；無重大角度變形' : '未見明顯 OA 或骨變形'}>
      <ellipse cx="60" cy="45" rx="40" ry="36" fill="url(#xrSoft)" />
      <path d="M50 4 L70 4 L72 30 Q78 36 76 42 L44 42 Q42 36 48 30 Z" fill={BONE} />
      {/* trochlear groove hint */}
      <path d="M54 34 Q60 38 66 34" stroke="#64748B" strokeWidth="1" fill="none" />
      <path d="M44 46 L76 46 L72 54 L66 56 L64 86 L56 86 L54 56 L48 54 Z" fill={BONE} />
      {/* tibial tuberosity */}
      <circle cx={60 + (caseId === 'C04' ? (medialOnRight ? 4 : -4) : 0)} cy={54} r={2.6} fill="#E2E8F0" />
      {/* patella */}
      <ellipse cx={60 + shift} cy={34} rx={4.5} ry={6} fill="#F8FAFC" stroke="#38BDF8" strokeWidth=".4" />
      <text x={medialOnRight ? 104 : 16} y={60} fontSize="3.6" fill="#94A3B8" textAnchor="middle">內側 M</text>
      <text x={medialOnRight ? 16 : 104} y={60} fontSize="3.6" fill="#94A3B8" textAnchor="middle">外側 L</text>
    </Frame>
  );
}

const RENDERERS: Record<string, () => ReactNode> = {
  'C01-IMG': () => <StifleLateral caseId="C01" />,
  'C02-IMG': () => <StifleLateral caseId="C02" />,
  'C03-IMG': () => <HipVD bilateral={false} />,
  'C04-IMG': () => <StifleCrCd caseId="C04" />,
  'C05-IMG': () => <StifleCrCd caseId="C05" />,
  'C06-IMG': () => <HipVD bilateral />,
  'C07-IMG': () => <FractureXRay caseId="C07" />,
  'C08-IMG': () => <FractureXRay caseId="C08" />,
};

export const hasXRay = (imageId: string | null) => !!imageId && imageId in RENDERERS;

export function XRayPanel({ imageId }: { imageId: string | null }) {
  if (!imageId || !RENDERERS[imageId]) {
    return (
      <div className="banner warn" role="note">
        <span aria-hidden>🖼️</span>
        <span>影像素材待製作，本關以文字判讀結果呈現。</span>
      </div>
    );
  }
  if (imageId === 'C07-IMG' || imageId === 'C08-IMG') return <FractureViewer caseId={imageId.slice(0, 3)} />;
  return (
    <div>
      <div className="xray">{RENDERERS[imageId]()}</div>
      <p className="small muted" style={{ margin: '4px 0 0' }}>本病例資料只提供單一投照的教學示意（非臨床影像）。</p>
    </div>
  );
}

/** Orthogonal view switcher for the fracture schematics (same model state in both views). */
function FractureViewer({ caseId }: { caseId: string }) {
  const m = FRACTURE_MODELS[caseId];
  const [view, setView] = useState<'both' | ViewKey>('both');
  return (
    <div>
      <div className="view-tabs" role="group" aria-label="投照視角">
        {(['both', 'primary', 'secondary'] as const).map((v) => (
          <button key={v} className="btn sm" aria-pressed={view === v} onClick={() => setView(v)} data-testid={`xray-view-${v}`}>
            {v === 'both' ? '兩視角並排' : m.views[v].label}
          </button>
        ))}
        <span className="small muted" style={{ alignSelf: 'center' }}>
          側標 {m.sideLabel}・教學示意，非臨床影像
        </span>
      </div>
      <FractureXRay caseId={caseId} only={view === 'both' ? undefined : view} />
    </div>
  );
}
