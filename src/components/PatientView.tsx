// Seated three-quarter patient illustration (Modern Cozy Flat Vector).
//
// Orientation: the patient FACES THE VIEWER, turned slightly toward the
// viewer's left. Therefore the patient's LEFT limbs are on the SCREEN RIGHT and
// slightly nearer (larger, lighter); the RIGHT limbs are on the screen left and
// slightly farther (smaller, shaded). Nothing is mirrored, so the anatomical
// codes (LF/RF/LH/RH) on every limb group are always correct.
//
// Layers (each its own <g>, stable data-part / data-limb markers):
//   tail · limbs (one group per limb, affected ones data-part="injured-limb") ·
//   torso (breathing) · head (eyes blink independently)
// Nested groups keep animations from overriding each other:
//   limb-root (static pose) > limping-tremor > palpation-withdraw > artwork

import { useId, type CSSProperties, type ReactNode } from 'react';
import type { PatientPose, Species } from '../types';
import { LIMB_LABEL, type Limb } from '../data/caseMeta';
import './PatientView.css';

export interface PatientViewProps {
  species: Species;
  breed: string;
  pose?: PatientPose;
  /** Anatomical limbs from the case's 患側; [] = unknown, nothing is guessed. */
  affectedLimbs?: readonly Limb[];
  /** Increment once per valid orthopaedic examination to (re)play the withdrawal. */
  palpationTrigger?: number;
  reducedMotion?: boolean;
  /** Rendered width in px (standalone) or user units (nested). */
  size?: number;
  label?: string;
  /** Render as a nested <svg> inside another SVG scene at (x, y); no caption. */
  nested?: { x: number; y: number };
  /** Scene hook: extra artwork drawn inside a limb (e.g. a tag). */
  limbOverlay?: (limb: Limb) => ReactNode;
}

/** Parse the case's 患側 text into anatomical limbs. Unknown text returns []: never guess. */
export function limbsFromSide(side: string): Limb[] {
  const t = side.replace(/\s/g, '');
  if (/雙髖|雙後肢/.test(t)) return ['LH', 'RH'];
  if (/雙前肢/.test(t)) return ['LF', 'RF'];
  const m = /([左右])([前後])肢/.exec(t);
  if (!m) return [];
  return [`${m[1] === '左' ? 'L' : 'R'}${m[2] === '前' ? 'F' : 'H'}` as Limb];
}

/** Affected limbs the pose holds off the ground. Asymptomatic / stiff poses lift nothing. */
export function raisedLimbs(pose: PatientPose, affected: readonly Limb[]): Limb[] {
  if (pose === 'fore-lift') return affected.filter((l) => l.endsWith('F'));
  if (pose === 'hind-lift' || pose === 'crouch') return affected.filter((l) => l.endsWith('H'));
  return [];
}

// ---------------------------------------------------------------- looks
type Tone = [light: string, base: string, shade: string];
interface Look {
  cat: boolean;
  body: Tone;
  head: Tone;
  legs: Tone;
  chest: [string, string];
  ears: 'drop' | 'long' | 'curly' | 'erect' | 'fluffy' | 'cat';
  coat: 'smooth' | 'silky' | 'curly' | 'fluffy' | 'tabby';
  tail: 'otter' | 'plume' | 'curl' | 'cat' | 'silky';
  muzzle: [string, string];
  nose: string;
  inner?: string;
  stripes?: string;
}

const T = (light: string, base: string, shade: string): Tone => [light, base, shade];

const LOOKS: Record<string, Look> = {
  // short smooth yellow coat, medium drop ears, thick "otter" tail
  拉布拉多: { cat: false, body: T('#FBEBC4', '#EBCB8A', '#C9A15E'), head: T('#FCEFCF', '#EDCF92', '#CBA465'), legs: T('#FBEBC4', '#E9C886', '#C59C59'), chest: ['#FFF8E6', '#F6E3B8'], ears: 'drop', coat: 'smooth', tail: 'otter', muzzle: ['#FFF6E2', '#F3DDB0'], nose: '#4A3B33' },
  // apricot curls, topknot and scalloped ears
  玩具貴賓: { cat: false, body: T('#F6DCC0', '#E2B48A', '#B98664'), head: T('#F8E2CA', '#E6BA92', '#BC8A66'), legs: T('#F6DCC0', '#E0B087', '#B58060'), chest: ['#FBEAD8', '#EFCCA8'], ears: 'curly', coat: 'curly', tail: 'curl', muzzle: ['#FAE8D5', '#EECCA9'], nose: '#3F302B' },
  // steel-grey body, tan head and legs, small erect ears
  約克夏: { cat: false, body: T('#9AA3B0', '#6E7886', '#4E5765'), head: T('#E9C995', '#D2A464', '#A9773E'), legs: T('#E6C38D', '#CC9C5C', '#A4733A'), chest: ['#EDD2A6', '#D8AF74'], ears: 'erect', coat: 'silky', tail: 'curl', muzzle: ['#F1D7AC', '#DDB57C'], nose: '#2F2A2A' },
  // orange double coat: neck ruff, tiny erect ears, plume tail over the back
  博美: { cat: false, body: T('#FCDDB0', '#F3B66E', '#D58C3F'), head: T('#FDE3BD', '#F5BD78', '#D89148'), legs: T('#FCDDB0', '#F0B068', '#CF853A'), chest: ['#FFF0DA', '#F9D3A0'], ears: 'fluffy', coat: 'fluffy', tail: 'plume', muzzle: ['#FFF0DC', '#F8D6A8'], nose: '#3A2D28' },
  // brown mixed breed: white chest and muzzle, semi-drop ears
  米克斯: { cat: false, body: T('#D9B48E', '#B98B5E', '#8E6640'), head: T('#DDB993', '#BE9063', '#936A44'), legs: T('#D9B48E', '#B58759', '#8A623D'), chest: ['#FFFBF4', '#F1E6DA'], ears: 'drop', coat: 'smooth', tail: 'otter', muzzle: ['#FFFBF5', '#EFE4D8'], nose: '#3A2E2A' },
  // pure white long silky coat, long feathered ears, topknot
  瑪爾濟斯: { cat: false, body: T('#FFFFFF', '#F4EFE6', '#C8BCAD'), head: T('#FFFFFF', '#F6F1EA', '#CBBFB1'), legs: T('#FFFFFF', '#F1EBE2', '#C4B8A9'), chest: ['#FFFFFF', '#F8F5F0'], ears: 'long', coat: 'silky', tail: 'silky', muzzle: ['#FFFFFF', '#F4EFE8'], nose: '#2C2726' },
  // grey tabby cat
  短毛家貓: { cat: true, body: T('#C9CED3', '#9CA4AD', '#6D7680'), head: T('#CDD2D7', '#A1A9B2', '#717A84'), legs: T('#CBD0D5', '#9AA2AB', '#6B747E'), chest: ['#EEF0F2', '#D5DADF'], ears: 'cat', coat: 'tabby', tail: 'cat', muzzle: ['#F2F3F5', '#DADDE1'], nose: '#C98E92', inner: '#E8C4C2', stripes: '#5F6872' },
  // orange tabby with white chest
  '米克斯（短毛貓）': { cat: true, body: T('#F7D2A2', '#E8A15C', '#C27634'), head: T('#F8D6A8', '#EAA662', '#C47A38'), legs: T('#F7D2A2', '#E69E58', '#BF7330'), chest: ['#FFF8EE', '#F5E4CF'], ears: 'cat', coat: 'tabby', tail: 'cat', muzzle: ['#FFF8EF', '#F3E2CD'], nose: '#D38E86', inner: '#F2C1B4', stripes: '#B76A2B' },
};

const DEFAULT_DOG = LOOKS['米克斯'];
const DEFAULT_CAT = LOOKS['短毛家貓'];

// ---------------------------------------------------------------- geometry
const GROUND = 334;
/** proximal joint (shoulder / hip) of each limb, used as transform-origin */
export const LIMB_JOINT: Record<Limb, [number, number]> = { RF: [146, 226], LF: [196, 226], RH: [114, 262], LH: [226, 262] };
/** which way "towards the body" rotates for this limb (screen-right limbs rotate counter-clockwise) */
const WITHDRAW_DIR: Record<Limb, number> = { RF: 1, LF: -1, RH: 1, LH: -1 };

/** reflect an x coordinate around the body midline (x = 170) */
const mx = (x: number) => 340 - x;
/** build a path from a template using a coordinate transform (for left/right pairs) */
function pathOf(points: (number | string)[], flip: boolean): string {
  let out = '';
  let isX = true;
  let relative = false;
  for (const p of points) {
    if (typeof p === 'string') {
      out += ` ${p}`;
      relative = p === p.toLowerCase();
      isX = true;
      continue;
    }
    // absolute x reflects around the midline; relative dx just changes sign
    const v = isX && flip ? (relative ? -p : mx(p)) : p;
    out += ` ${v.toFixed(1)}`;
    isX = !isX;
  }
  return out.trim();
}

/**
 * Generous hit box (viewBox units) around a limb, for scenes that overlay tool targets.
 * Hind boxes start below the shoulder line so a raised forelimb never hides them.
 */
export function limbBox(limb: Limb, raised: boolean): { x: number; y: number; width: number; height: number } {
  const fore = limb.endsWith('F');
  const [x, y, width, height] = fore ? (raised ? [174, 208, 76, 82] : [164, 208, 58, 128]) : raised ? [194, 252, 82, 60] : [194, 252, 70, 84];
  return { x: limb.startsWith('R') ? 340 - x - width : x, y, width, height };
}

// forelimb (screen-right = patient's LEFT template; flip for the right limb)
const FORE_STAND = ['M', 180, 224, 'C', 178, 256, 184, 290, 182, 314, 'C', 170, 318, 168, GROUND, 184, GROUND, 'L', 206, GROUND, 'C', 218, GROUND, 218, 320, 206, 314, 'C', 208, 290, 214, 254, 212, 224, 'C', 206, 212, 186, 212, 180, 224, 'Z'];
// flexed carpus, paw held clear of the ground
const FORE_LIFT = ['M', 180, 224, 'C', 178, 248, 184, 266, 196, 276, 'C', 206, 284, 220, 288, 232, 284, 'C', 246, 279, 246, 264, 234, 260, 'C', 222, 257, 212, 254, 210, 244, 'C', 209, 236, 214, 230, 212, 224, 'C', 206, 212, 186, 212, 180, 224, 'Z'];
// haunch + hind paw resting forward on the ground
const HIND_HAUNCH = ['M', 214, 246, 'C', 244, 252, 260, 286, 252, 310, 'C', 246, 326, 226, 330, 210, 322, 'C', 198, 312, 196, 280, 204, 258, 'Z'];
const HIND_PAW = ['M', 214, 322, 'C', 226, 318, 252, 318, 258, 326, 'C', 262, 332, 258, GROUND, 250, GROUND, 'L', 214, GROUND, 'C', 206, GROUND, 204, 326, 214, 322, 'Z'];
// paw lifted off the ground and tucked forward
const HIND_PAW_LIFT = ['M', 222, 292, 'C', 234, 280, 258, 280, 266, 290, 'C', 272, 298, 268, 306, 258, 306, 'L', 230, 308, 'C', 218, 308, 214, 300, 222, 292, 'Z'];

export function PatientView({
  species,
  breed,
  pose = 'stand-alert',
  affectedLimbs = [],
  palpationTrigger = 0,
  reducedMotion = false,
  size = 340,
  label,
  nested,
  limbOverlay,
}: PatientViewProps) {
  const uid = `pv${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const look = LOOKS[breed] ?? (species === '貓' ? DEFAULT_CAT : DEFAULT_DOG);
  const cat = look.cat;
  const affected = new Set(affectedLimbs);
  const raised = new Set(raisedLimbs(pose, affectedLimbs));
  const uncomfortable = raised.size > 0;
  const g = (name: string) => `${uid}-${name}`;
  // gradient ids live in their own namespace so they never collide with layer ids (e.g. head)
  const fillId = (name: string) => g(`fill-${name}`);
  const url = (name: string) => `url(#${fillId(name)})`;
  const sideText = affectedLimbs.length ? affectedLimbs.map((l) => LIMB_LABEL[l]).join('、') : '患側未指定';
  const title = label ?? `${breed}（${species}）坐姿示意，${sideText}${uncomfortable ? `，${[...raised].map((l) => LIMB_LABEL[l]).join('、')}不負重` : ''}`;
  const desc = `姿態教學示意插畫：病患面向觀看者，病患左側在畫面右側。${uncomfortable ? '患肢輕度抬離地面。' : '四肢正常承重。'}動畫為教學情境，不代表疼痛量表或診斷結果。`;
  const stroke = (t: Tone) => ({ stroke: t[2], strokeWidth: 1.5, strokeOpacity: 0.7 });

  // -------------------------------------------------------------- limbs
  const limb = (side: Limb) => {
    const fore = side.endsWith('F');
    const flip = side.startsWith('R'); // right limbs are the mirrored, farther ones
    const far = flip;
    const isRaised = raised.has(side);
    const injured = affected.has(side);
    const [jx, jy] = LIMB_JOINT[side];
    const tone = look.legs;
    const fill = url(far ? 'legFar' : 'leg');
    const origin = { transformOrigin: `${jx}px ${jy}px`, '--withdraw-dir': WITHDRAW_DIR[side] } as CSSProperties;
    const paws = fore ? (isRaised ? FORE_LIFT : FORE_STAND) : isRaised ? HIND_PAW_LIFT : HIND_PAW;
    const toeY = fore ? (isRaised ? 284 : GROUND - 2) : isRaised ? 306 : GROUND - 2;
    const toeX = fore ? (isRaised ? 232 : 195) : isRaised ? 250 : 236;
    const toes = [-6, 0, 6].map((d) => `M${(flip ? mx(toeX + d) : toeX + d).toFixed(1)} ${toeY - 6} l0 5`).join(' ');
    const art = (
      <>
        {!fore && <path d={pathOf(HIND_HAUNCH, flip)} fill={url(far ? 'bodyFar' : 'body')} {...stroke(look.body)} />}
        <path d={pathOf(paws, flip)} fill={fill} {...stroke(tone)} />
        {/* soft fur flow on the limb */}
        <path d={fore && !isRaised ? pathOf(['M', 192, 248, 'Q', 190, 276, 193, 300], flip) : fore ? pathOf(['M', 192, 246, 'Q', 196, 266, 206, 276], flip) : pathOf(['M', 222, 268, 'Q', 238, 284, 234, 304], flip)} fill="none" stroke={tone[2]} strokeOpacity=".28" strokeWidth="2" strokeLinecap="round" />
        <path d={toes} stroke={tone[2]} strokeOpacity=".6" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        {look.coat === 'silky' && !isRaised && fore && <path d={pathOf(['M', 180, 300, 'q', 4, 12, 2, 22, 'M', 210, 298, 'q', -3, 12, 0, 22], flip)} stroke={tone[2]} strokeOpacity=".3" strokeWidth="1.4" fill="none" />}
        {limbOverlay?.(side)}
      </>
    );
    return (
      <g
        key={side}
        id={g(injured ? `injured-limb-${side}` : `limb-${side}`)}
        className="pv-limb"
        data-limb={side}
        data-part={injured ? 'injured-limb' : 'limb'}
        data-raised={isRaised ? 'true' : 'false'}
        data-weight-bearing={isRaised ? 'false' : 'true'}
      >
        <title>{`${LIMB_LABEL[side]}${injured ? '（病例患肢）' : ''}`}</title>
        <g className={isRaised ? 'limping-tremor' : undefined} style={origin}>
          {/* key replays the withdrawal for every new valid examination */}
          <g key={`w${palpationTrigger}`} className={injured && palpationTrigger > 0 ? 'palpation-withdraw' : undefined} style={origin}>
            {art}
          </g>
        </g>
      </g>
    );
  };

  // -------------------------------------------------------------- ears
  const ear = (flip: boolean) => {
    const f = (pts: (number | string)[]) => pathOf(pts, flip);
    const fill = url('head');
    const s = stroke(look.head);
    switch (look.ears) {
      case 'drop':
        return <path d={f(['M', 214, 86, 'C', 236, 82, 252, 104, 250, 134, 'C', 249, 154, 236, 164, 224, 156, 'C', 214, 138, 208, 108, 214, 86, 'Z'])} fill={fill} {...s} />;
      case 'long':
        return (
          <>
            <path d={f(['M', 212, 84, 'C', 240, 80, 256, 110, 256, 150, 'C', 258, 178, 252, 200, 240, 206, 'C', 232, 200, 236, 190, 226, 196, 'C', 222, 186, 222, 176, 214, 172, 'C', 206, 140, 204, 104, 212, 84, 'Z'])} fill={fill} {...s} />
            <path d={f(['M', 226, 106, 'Q', 240, 140, 236, 186, 'M', 216, 118, 'Q', 226, 150, 222, 182])} stroke={look.head[2]} strokeOpacity=".3" strokeWidth="1.5" fill="none" />
          </>
        );
      case 'curly':
        return <path d={f(['M', 212, 86, 'C', 228, 76, 242, 86, 244, 98, 'C', 256, 102, 256, 118, 248, 124, 'C', 258, 132, 254, 148, 244, 150, 'C', 248, 162, 236, 170, 226, 162, 'C', 216, 168, 208, 158, 212, 148, 'C', 204, 128, 204, 104, 212, 86, 'Z'])} fill={fill} {...s} />;
      case 'erect':
        return <path d={f(['M', 200, 80, 'C', 208, 66, 220, 52, 232, 44, 'C', 236, 60, 234, 78, 226, 94, 'Z'])} fill={fill} {...s} />;
      case 'fluffy':
        return <path d={f(['M', 202, 76, 'C', 208, 64, 216, 56, 226, 52, 'C', 228, 64, 226, 76, 222, 86, 'Z'])} fill={fill} {...s} />;
      case 'cat':
        return (
          <>
            <path d={f(['M', 196, 82, 'C', 204, 66, 220, 50, 236, 42, 'C', 240, 62, 238, 84, 230, 102, 'Z'])} fill={fill} {...s} />
            <path d={f(['M', 206, 82, 'C', 212, 72, 222, 62, 230, 56, 'C', 232, 70, 230, 84, 226, 94, 'Z'])} fill={look.inner} opacity=".9" />
          </>
        );
    }
  };

  // -------------------------------------------------------------- eyes
  const eye = (x: number, y: number, key: string) => (
    <g key={key} className="patient-blink" data-part="eye">
      {cat ? (
        <>
          <path d={`M${x - 10} ${y} C${x - 6} ${y - 9} ${x + 6} ${y - 9} ${x + 10} ${y} C${x + 6} ${y + 8} ${x - 6} ${y + 8} ${x - 10} ${y} Z`} fill="#C9A44A" stroke="#4B4033" strokeWidth="1.2" />
          <path d={`M${x} ${y - 6} C${x - 2.4} ${y - 2} ${x - 2.4} ${y + 2} ${x} ${y + 6} C${x + 2.4} ${y + 2} ${x + 2.4} ${y - 2} ${x} ${y - 6} Z`} fill="#2B2420" />
        </>
      ) : (
        <>
          <path d={`M${x - 9} ${y} C${x - 8} ${y - 10} ${x + 8} ${y - 10} ${x + 9} ${y} C${x + 8} ${y + 9} ${x - 8} ${y + 9} ${x - 9} ${y} Z`} fill="#2E2725" />
          <path d={`M${x - 6} ${y + 2} C${x - 4} ${y + 7} ${x + 4} ${y + 7} ${x + 6} ${y + 2}`} stroke="#6A5547" strokeWidth="2" fill="none" opacity=".7" />
        </>
      )}
      <circle cx={x - 3} cy={y - 3} r="2.3" fill="#FFFFFF" />
      <circle cx={x + 3.2} cy={y + 2.8} r=".9" fill="#FFFFFF" opacity=".85" />
      {/* soft upper lid when the patient is uncomfortable: gentle, never a pain grimace */}
      {uncomfortable && <path d={`M${x - 10} ${y - 4} Q${x} ${y - 9} ${x + 10} ${y - 4}`} stroke={look.head[2]} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".8" />}
    </g>
  );

  // -------------------------------------------------------------- body pieces
  const torsoPath = 'M140 150 C128 176 110 204 108 236 C104 262 108 300 128 316 C142 326 198 326 212 316 C232 300 236 262 232 236 C230 204 212 176 200 150 C188 140 152 140 140 150 Z';
  const chestPath = cat
    ? 'M146 196 C140 222 146 250 156 266 C164 276 178 276 186 266 C196 250 200 222 194 196 C182 188 158 188 146 196 Z'
    : 'M142 192 C132 222 138 254 150 272 C160 284 182 284 192 270 C204 252 208 222 198 192 C184 184 156 184 142 192 Z';

  const tail = () => {
    const fill = url('body');
    const s = stroke(look.body);
    switch (look.tail) {
      case 'otter':
        return <path d="M226 312 C252 312 280 298 290 274 C294 262 286 256 280 266 C270 286 252 296 224 298 Z" fill={fill} {...s} />;
      case 'plume':
        return <path d="M214 214 C232 176 270 160 292 172 C306 180 302 200 288 206 C300 214 292 234 276 232 C282 246 266 256 254 248 C246 262 228 258 226 246 C214 240 210 226 214 214 Z" fill={fill} {...s} />;
      case 'curl':
        return <path d="M226 300 C246 292 262 276 258 258 C256 248 268 246 270 256 C276 280 258 304 228 312 Z" fill={fill} {...s} />;
      case 'silky':
        return (
          <>
            <path d="M224 300 C248 286 270 262 268 236 C268 226 280 226 282 236 C290 266 274 300 240 316 C252 318 252 326 240 326 C232 326 226 318 224 300 Z" fill={fill} {...s} />
            <path d="M262 246 Q270 276 248 304 M272 250 Q280 284 254 314" stroke={look.body[2]} strokeOpacity=".3" strokeWidth="1.4" fill="none" />
          </>
        );
      case 'cat':
        // wraps along the ground in front of the paws
        return <path d="M230 318 C266 330 300 322 300 300 C300 286 290 280 284 288 C292 300 280 314 254 316 C244 317 236 316 230 318 Z" fill={fill} {...s} />;
    }
  };

  const ruff = () => {
    // Pomeranian mane: soft outward-bulging bezier scallops around the face (no spikes, no circles)
    const n = 11;
    const at = (t: number, r: number) => {
      const a = Math.PI * (-0.1 + 1.2 * t);
      return `${(170 + Math.cos(a) * r).toFixed(1)} ${(152 + Math.sin(a) * r * 0.82).toFixed(1)}`;
    };
    let d = `M${at(0, 70)}`;
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const r = i % 2 ? 84 : 90;
      d += ` C${at(t0 + 0.2 / n, r)} ${at(t1 - 0.2 / n, r)} ${at(t1, 72)}`;
    }
    return <path d={`${d} Z`} fill={url('chest')} stroke={look.body[2]} strokeOpacity=".4" strokeWidth="1.3" />;
  };

  const headExtras = () => {
    if (look.coat === 'curly')
      return <path d="M140 76 C134 60 150 46 162 54 C168 42 186 44 190 56 C204 54 210 70 202 80 C190 74 152 72 140 76 Z" fill={url('head')} stroke={look.head[2]} strokeOpacity=".5" strokeWidth="1.3" />;
    if (look.coat === 'silky' && !cat)
      return <path d="M152 66 C152 52 166 46 172 56 C176 46 192 52 188 66 C178 62 162 62 152 66 Z" fill={url('head')} stroke={look.head[2]} strokeOpacity=".45" strokeWidth="1.2" />;
    if (look.coat === 'tabby')
      return <path d="M154 84 l5 11 l6 -9 l5 9 l6 -9 l5 9 l5 -11 M146 98 q-6 2 -10 8 M194 98 q6 2 10 8" stroke={look.stripes} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".75" />;
    return null;
  };

  const head = (
    <g id={g('head')} data-part="head" className="pv-head" transform="rotate(-4 170 170)">
      {ear(true)}
      {ear(false)}
      {/* skull */}
      <path
        d={cat ? 'M118 122 C114 92 138 72 170 72 C202 72 226 92 222 122 C220 150 200 168 170 168 C140 168 120 150 118 122 Z' : 'M120 120 C114 86 140 64 170 64 C200 64 226 86 220 120 C218 148 198 168 170 168 C142 168 122 148 120 120 Z'}
        fill={url('head')}
        {...stroke(look.head)}
      />
      {headExtras()}
      {eye(149, 114, 'eR')}
      {eye(191, 114, 'eL')}
      {/* muzzle */}
      <path d={cat ? 'M152 134 C152 126 162 124 170 130 C178 124 188 126 188 134 C190 146 180 152 170 150 C160 152 150 146 152 134 Z' : 'M146 134 C148 122 162 120 170 126 C178 120 192 122 194 134 C196 152 184 162 170 160 C156 162 144 152 146 134 Z'} fill={url('muzzle')} />
      <path d={cat ? 'M164 130 C164 126 176 126 176 130 C176 134 172 137 170 137 C168 137 164 134 164 130 Z' : 'M161 128 C161 121 179 121 179 128 C179 135 172 139 170 139 C168 139 161 135 161 128 Z'} fill={look.nose} />
      <path d={cat ? 'M170 137 L170 141 M162 144 Q166 148 170 141 Q174 148 178 144' : 'M170 139 L170 145 M160 147 Q165 152 170 145 Q175 152 180 147'} stroke="#4A3D38" strokeWidth="1.7" strokeLinecap="round" fill="none" />
      {cat && <path d="M154 138 L124 132 M154 143 L122 145 M186 138 L216 132 M186 143 L218 145" stroke={look.head[2]} strokeWidth="1.1" strokeLinecap="round" opacity=".7" />}
      {/* soft cheek fur */}
      <path d="M126 140 q-4 10 4 16 M214 140 q4 10 -4 16" stroke={look.head[2]} strokeOpacity=".3" strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  );

  const torso = (
    <g id={g('torso')} data-part="torso" className="pv-torso">
      {/* breathing is on an inner group so the torso's own placement never changes */}
      <g className="breathing">
        <path d={torsoPath} fill={url('body')} {...stroke(look.body)} />
        <path d={chestPath} fill={url('chest')} />
        {look.coat === 'silky' && <path d="M122 236 q-6 30 0 58 M218 236 q6 30 0 58 M150 280 q2 18 -2 34 M190 280 q-2 18 2 34" stroke={look.body[2]} strokeOpacity=".25" strokeWidth="1.6" fill="none" strokeLinecap="round" />}
        {look.coat === 'tabby' && <path d="M116 236 q14 6 18 18 M112 260 q16 6 20 18 M224 236 q-14 6 -18 18 M228 260 q-16 6 -20 18" stroke={look.stripes} strokeOpacity=".55" strokeWidth="3" fill="none" strokeLinecap="round" />}
        {look.coat === 'curly' && <path d="M126 220 q6 -6 12 0 q6 -6 12 0 M196 222 q6 -6 12 0 q6 -6 12 0 M120 254 q6 -6 12 0 M206 256 q6 -6 12 0" stroke={look.body[2]} strokeOpacity=".35" strokeWidth="1.6" fill="none" strokeLinecap="round" />}
        {look.coat === 'smooth' && <path d="M126 230 q-8 26 -2 52 M214 230 q8 26 2 52" stroke={look.body[2]} strokeOpacity=".25" strokeWidth="2" fill="none" strokeLinecap="round" />}
      </g>
    </g>
  );

  const svgProps = nested
    ? { x: nested.x, y: nested.y, width: size, height: (size * 380) / 340 }
    : { width: size, height: (size * 380) / 340, className: 'patient-view' };

  const svg = (
    <svg
      {...svgProps}
      viewBox="0 0 340 380"
      role="img"
      aria-labelledby={`${g('title')} ${g('desc')}`}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      data-pose={pose}
      data-raised={[...raised].join(' ')}
      data-palpation={palpationTrigger}
      data-testid="patient-view"
      className={`patient-view ${nested ? 'nested' : ''}`}
    >
      <title id={g('title')}>{title}</title>
      <desc id={g('desc')}>{desc}</desc>
      <defs>
        {(
          [
            ['body', look.body],
            ['head', look.head],
            ['leg', look.legs],
          ] as const
        ).map(([name, t]) => (
          <linearGradient key={name} id={fillId(name)} x1="0" y1="0" x2=".7" y2="1">
            <stop offset="0" stopColor={t[0]} />
            <stop offset=".55" stopColor={t[1]} />
            <stop offset="1" stopColor={t[2]} />
          </linearGradient>
        ))}
        {/* farther (patient-right) side: same coat, one step darker for depth */}
        <linearGradient id={fillId('bodyFar')} x1="0" y1="0" x2=".7" y2="1">
          <stop offset="0" stopColor={look.body[1]} />
          <stop offset="1" stopColor={look.body[2]} />
        </linearGradient>
        <linearGradient id={fillId('legFar')} x1="0" y1="0" x2=".7" y2="1">
          <stop offset="0" stopColor={look.legs[1]} />
          <stop offset="1" stopColor={look.legs[2]} />
        </linearGradient>
        <linearGradient id={fillId('chest')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={look.chest[0]} />
          <stop offset="1" stopColor={look.chest[1]} />
        </linearGradient>
        <linearGradient id={fillId('muzzle')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={look.muzzle[0]} />
          <stop offset="1" stopColor={look.muzzle[1]} />
        </linearGradient>
        <radialGradient id={fillId('halo')}>
          <stop offset="0" stopColor="#E3F1EE" stopOpacity=".8" />
          <stop offset="1" stopColor="#F1F8F6" stopOpacity="0" />
        </radialGradient>
      </defs>
      {!nested && <ellipse cx="170" cy="210" rx="160" ry="160" fill={url('halo')} />}
      {/* ground shadow */}
      <path d={`M80 ${GROUND + 2} C110 ${GROUND - 6} 230 ${GROUND - 6} 276 ${GROUND + 2} C230 ${GROUND + 10} 110 ${GROUND + 10} 80 ${GROUND + 2} Z`} fill="#4B5A5E" opacity=".12" />
      <g className="patient-figure" strokeLinejoin="round" strokeLinecap="round">
        {look.tail !== 'cat' && (
          // a resting tail lies on the far side of a lifted left hind paw so the two never merge
          <g id={g('tail')} data-part="tail" transform={raised.has('LH') ? 'translate(340 0) scale(-1 1)' : undefined}>
            {tail()}
          </g>
        )}
        {limb('RH')}
        {limb('LH')}
        {torso}
        {look.coat === 'fluffy' && ruff()}
        {!cat && <path d="M136 190 Q170 210 204 190" fill="none" stroke="#5FA7B0" strokeWidth="8" strokeLinecap="round" />}
        {limb('RF')}
        {limb('LF')}
        {/* a cat's tail wraps around the front paws, so it is drawn in front of them */}
        {look.tail === 'cat' && (
          <g id={g('tail')} data-part="tail">
            {tail()}
          </g>
        )}
        {head}
      </g>
    </svg>
  );

  if (nested) return svg;
  const cue = reducedMotion && palpationTrigger > 0 && affectedLimbs.length > 0;
  return (
    <figure className="patient-view-wrap" style={{ margin: 0 }}>
      {svg}
      {cue && (
        <figcaption className="patient-view-cue" role="status" data-testid="palpation-cue">
          觸診回饋：患肢輕微收回（教學示意）
        </figcaption>
      )}
    </figure>
  );
}

export default PatientView;
