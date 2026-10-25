// Original flat-vector scene art for the scene-based levels (no external assets).
// Characters are friendly and bloodless; discomfort = lifted limb, ears back,
// squinting eyes. Every interactive body part is a separate group so it can be
// a tool target.

import type { ReactNode, SVGProps } from 'react';
import type { Limb } from '../data/caseMeta';

// ---------------- people ----------------
export function Owner({ x, y, scale = 1, talking = false }: { x: number; y: number; scale?: number; talking?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} aria-label="飼主">
      <ellipse cx="0" cy="372" rx="70" ry="12" fill="#3E4650" opacity=".08" />
      {/* legs */}
      <rect x="-34" y="250" width="28" height="118" rx="12" fill="#5B6670" />
      <rect x="6" y="250" width="28" height="118" rx="12" fill="#5B6670" />
      <rect x="-40" y="356" width="36" height="16" rx="8" fill="#4A5058" />
      <rect x="4" y="356" width="36" height="16" rx="8" fill="#4A5058" />
      {/* body */}
      <path d="M-58 120 Q-60 92 -30 86 L30 86 Q60 92 58 120 L52 262 L-52 262 Z" fill="#DE9C78" />
      <path d="M-20 86 L0 120 L20 86" fill="#F6DCC8" />
      {/* arms */}
      <path d="M-56 110 Q-84 170 -60 230" stroke="#DE9C78" strokeWidth="26" fill="none" strokeLinecap="round" />
      <path d="M56 110 Q86 160 70 214" stroke="#DE9C78" strokeWidth="26" fill="none" strokeLinecap="round" />
      <circle cx="-60" cy="234" r="14" fill="#F2C7A5" />
      <circle cx="70" cy="218" r="14" fill="#F2C7A5" />
      {/* leash */}
      <path d="M72 222 Q140 250 190 262" stroke="#6FA6AC" strokeWidth="4" fill="none" />
      {/* head */}
      <rect x="-12" y="62" width="24" height="28" rx="10" fill="#F2C7A5" />
      <circle cx="0" cy="38" r="40" fill="#F2C7A5" />
      <path d="M-42 34 Q-44 -8 0 -6 Q44 -8 42 34 Q34 8 0 12 Q-30 10 -42 34 Z" fill="#7A4B36" />
      <circle cx="-14" cy="40" r="4.5" fill="#1F2937" />
      <circle cx="14" cy="40" r="4.5" fill="#1F2937" />
      <path d="M-14 26 q6 -4 12 0 M2 26 q6 -4 12 0" stroke="#7A4B36" strokeWidth="3" fill="none" strokeLinecap="round" />
      {talking ? <ellipse cx="0" cy="58" rx="8" ry="6" fill="#8C5440" /> : <path d="M-8 58 q8 6 16 0" stroke="#8C5440" strokeWidth="3" fill="none" strokeLinecap="round" />}
    </g>
  );
}

export function Vet({ x, y, scale = 1, wave = false }: { x: number; y: number; scale?: number; wave?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} aria-label="獸醫（玩家）">
      <ellipse cx="0" cy="372" rx="70" ry="12" fill="#3E4650" opacity=".08" />
      <rect x="-32" y="250" width="26" height="118" rx="12" fill="#56697A" />
      <rect x="6" y="250" width="26" height="118" rx="12" fill="#56697A" />
      <rect x="-38" y="356" width="34" height="16" rx="8" fill="#3E4650" />
      <rect x="4" y="356" width="34" height="16" rx="8" fill="#3E4650" />
      {/* white coat */}
      <path d="M-62 122 Q-62 90 -30 84 L30 84 Q62 90 62 122 L60 300 L-60 300 Z" fill="#FFFFFF" stroke="#D8D6D0" strokeWidth="3" />
      <path d="M-14 84 L0 140 L14 84 Z" fill="#6FA6AC" />
      <path d="M0 140 L0 296" stroke="#D8D6D0" strokeWidth="3" />
      <rect x="-48" y="170" width="28" height="22" rx="4" fill="none" stroke="#D8D6D0" strokeWidth="3" />
      {/* stethoscope */}
      <path d="M-24 96 Q-36 170 -6 186 Q18 196 26 160" stroke="#5B6670" strokeWidth="5" fill="none" />
      <circle cx="26" cy="156" r="8" fill="#DE9C78" />
      {/* arms */}
      <path d={wave ? 'M58 112 Q96 70 92 26' : 'M58 112 Q84 170 66 228'} stroke="#FFFFFF" strokeWidth="28" fill="none" strokeLinecap="round" />
      <path d={wave ? 'M58 112 Q96 70 92 26' : 'M58 112 Q84 170 66 228'} stroke="#D8D6D0" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".6" />
      <path d="M-58 112 Q-84 170 -66 228" stroke="#FFFFFF" strokeWidth="28" fill="none" strokeLinecap="round" />
      <circle cx={wave ? 92 : 66} cy={wave ? 20 : 232} r="14" fill="#D7E7E6" />
      <circle cx="-66" cy="232" r="14" fill="#D7E7E6" />
      {/* head */}
      <rect x="-12" y="60" width="24" height="28" rx="10" fill="#F5D0B5" />
      <circle cx="0" cy="36" r="40" fill="#F5D0B5" />
      <path d="M-42 30 Q-40 -10 0 -8 Q40 -10 42 30 Q30 4 -2 8 Q-28 8 -42 30 Z" fill="#5B6670" />
      <circle cx="-14" cy="38" r="4.5" fill="#1F2937" />
      <circle cx="14" cy="38" r="4.5" fill="#1F2937" />
      <path d="M-10 56 q10 8 20 0" stroke="#7A4B36" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="-30" y="-14" width="60" height="16" rx="8" fill="#6FA6AC" />
    </g>
  );
}

// ---------------- room ----------------
export function ExamRoom({ w, h }: { w: number; h: number }) {
  return (
    <g aria-hidden>
      <defs>
        <linearGradient id="roomWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F8F4EC" />
          <stop offset="1" stopColor="#EEF1EA" />
        </linearGradient>
        <linearGradient id="roomFloor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F1EBE1" />
          <stop offset="1" stopColor="#E4DCCF" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill="url(#roomWall)" />
      <rect y={h * 0.7} width={w} height={h * 0.3} fill="url(#roomFloor)" />
      <line x1="0" y1={h * 0.7} x2={w} y2={h * 0.7} stroke="#DCD4C7" strokeWidth="4" />
      {/* window */}
      <rect x="90" y="70" width="230" height="170" rx="14" fill="#DCEAEC" stroke="#A9BFC4" strokeWidth="6" />
      <path d="M205 70 V240 M90 155 H320" stroke="#A9BFC4" strokeWidth="6" />
      <circle cx="270" cy="110" r="18" fill="#FBF1DC" />
      {/* shelf with bottles */}
      <rect x="1280" y="150" width="240" height="12" rx="6" fill="#C3BBAE" />
      {[1300, 1350, 1400, 1450].map((x, i) => (
        <rect key={x} x={x} y={150 - 40 - (i % 2) * 12} width="30" height={40 + (i % 2) * 12} rx="6" fill={['#B7D3D8', '#E8C9AE', '#BFD6C0', '#D6CCE0'][i]} />
      ))}
      {/* plant */}
      <rect x="1460" y={h * 0.7 - 70} width="60" height="70" rx="10" fill="#D8AE96" />
      <path d="M1490 540 q-40 -60 -10 -110 q20 50 10 110 q30 -70 60 -90 q-10 60 -60 90" fill="#93B79A" />
    </g>
  );
}

export function ExamTable({ x, y, w = 560 }: { x: number; y: number; w?: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden>
      <rect x="0" y="0" width={w} height="34" rx="17" fill="#7DB3B4" />
      <rect x="10" y="4" width={w - 20} height="10" rx="5" fill="#B8DCDA" opacity=".6" />
      <rect x={w * 0.12} y="34" width="22" height="150" fill="#BDB7AE" />
      <rect x={w * 0.85} y="34" width="22" height="150" fill="#BDB7AE" />
      <rect x={w * 0.08} y="180" width={w * 0.84} height="16" rx="8" fill="#A39D94" />
    </g>
  );
}

// ---------------- scene dog with separately targetable limbs ----------------
export interface LimbGeo {
  id: Limb;
  /** attachment point (shoulder / hip) in dog-local coordinates */
  ax: number;
  ay: number;
  far: boolean;
}

export const DOG_LIMBS: LimbGeo[] = [
  { id: 'RH', ax: 72, ay: 130, far: true },
  { id: 'RF', ax: 212, ay: 130, far: true },
  { id: 'LH', ax: 124, ay: 146, far: false },
  { id: 'LF', ax: 264, ay: 146, far: false },
];

export const limbLength = (g: LimbGeo) => (g.far ? 70 : 74);
export const limbRotation = (id: Limb, lifted: Limb | null) => (lifted === id ? (id.endsWith('F') ? -42 : 30) : 0);

/**
 * Side view facing right: the viewer sees the dog's LEFT side (near limbs);
 * right limbs are drawn behind, offset up-left and darker so each limb is a
 * distinct target.
 */
export function SceneDog({
  x,
  y,
  scale = 1,
  lifted,
  coat = { body: '#FAF7F2', dark: '#DCD3C6', light: '#FFFFFF' },
  limbProps,
  limbOverlay,
  uncomfortable = true,
  walking = false,
}: {
  x: number;
  y: number;
  scale?: number;
  lifted?: Limb | null;
  coat?: { body: string; dark: string; light: string };
  limbProps?: (l: Limb) => SVGProps<SVGGElement>;
  limbOverlay?: (l: Limb) => ReactNode;
  uncomfortable?: boolean;
  walking?: boolean;
}) {
  const leg = (g: LimbGeo) => {
    const isLifted = lifted === g.id;
    const fill = g.far ? coat.dark : coat.body;
    const rot = limbRotation(g.id, lifted ?? null);
    const len = limbLength(g);
    return (
      <g key={g.id} {...(limbProps?.(g.id) ?? {})} data-limb={g.id}>
        {/* rotation lives on the outer group: a CSS animation on the same element would override it */}
        <g transform={`rotate(${rot} ${g.ax} ${g.ay})`}>
        <g className={walking && !isLifted ? 'dog-step' : isLifted ? 'anim-limb' : undefined}>
          {/* generous transparent hit area */}
          <rect x={g.ax - 26} y={g.ay - 8} width="52" height={len + 26} rx="22" fill="transparent" />
          <rect x={g.ax - 13} y={g.ay} width="26" height={len} rx="13" fill={fill} stroke="#A8A29E" strokeOpacity=".5" strokeWidth="3" />
          <ellipse cx={g.ax + 4} cy={g.ay + len} rx="17" ry="9" fill={fill} stroke="#A8A29E" strokeOpacity=".5" strokeWidth="3" />
          {limbOverlay?.(g.id)}
        </g>
        </g>
      </g>
    );
  };
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} aria-label="病患：瑪爾濟斯犬">
      <ellipse cx="180" cy="232" rx="150" ry="12" fill="#0F172A" opacity=".1" />
      {/* tail */}
      <path className="anim-tail" d={uncomfortable ? 'M64 112 q-40 10 -50 44' : 'M64 104 q-30 -24 -30 -60'} stroke={coat.dark} strokeWidth="18" fill="none" strokeLinecap="round" />
      {DOG_LIMBS.filter((l) => l.far).map(leg)}
      {/* body with fluffy coat */}
      <g className="anim-breathe">
        <ellipse cx="172" cy="118" rx="118" ry="54" fill={coat.body} stroke="#A8A29E" strokeOpacity=".45" strokeWidth="3" />
        {[90, 130, 170, 210, 250].map((cx) => (
          <circle key={cx} cx={cx} cy="74" r="20" fill={coat.light} opacity=".9" />
        ))}
        <ellipse cx="176" cy="140" rx="90" ry="24" fill={coat.light} opacity=".7" />
      </g>
      {DOG_LIMBS.filter((l) => !l.far).map(leg)}
      {/* head */}
      <g transform={uncomfortable ? 'rotate(6 300 70)' : undefined}>
        <circle cx="304" cy="64" r="46" fill={coat.body} stroke="#A8A29E" strokeOpacity=".45" strokeWidth="3" />
        <ellipse cx="344" cy="80" rx="26" ry="18" fill={coat.light} stroke="#A8A29E" strokeOpacity=".4" strokeWidth="3" />
        <ellipse cx="366" cy="74" rx="8" ry="7" fill="#1F2937" />
        <path d="M346 94 q8 5 16 0" stroke="#78716C" strokeWidth="3" fill="none" strokeLinecap="round" />
        {uncomfortable ? (
          <path d="M310 54 q8 6 16 0" stroke="#1F2937" strokeWidth="4" fill="none" strokeLinecap="round" />
        ) : (
          <circle cx="318" cy="54" r="6" fill="#1F2937" />
        )}
        {/* ears: back when uncomfortable */}
        <path className="anim-ear" d={uncomfortable ? 'M290 26 q-48 4 -52 54 q24 6 44 -16 z' : 'M286 24 q-14 46 6 74 q22 -22 16 -64 z'} fill={coat.dark} />
        <rect x="262" y="96" width="44" height="12" rx="6" fill="#0284C7" />
        <circle cx="284" cy="114" r="6" fill="#F97316" />
      </g>
    </g>
  );
}

// ---------------- tool icons (64×64) ----------------
export type ToolIconId =
  | 'tag'
  | 'observe'
  | 'palpate'
  | 'xray'
  | 'chart'
  | 'grasp'
  | 'clamp'
  | 'plate'
  | 'drill'
  | 'gauge'
  | 'screw'
  | 'carm';

const metal = (id: string) => (
  <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stopColor="#F1F5F9" />
    <stop offset=".5" stopColor="#CBD5E1" />
    <stop offset="1" stopColor="#94A3B8" />
  </linearGradient>
);
const ti = (id: string) => (
  <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stopColor="#7DD3FC" />
    <stop offset=".5" stopColor="#38BDF8" />
    <stop offset="1" stopColor="#0369A1" />
  </linearGradient>
);

export function ToolIcon({ id, size = 56 }: { id: ToolIconId; size?: number }) {
  const g = `ti-${id}`;
  let body: ReactNode;
  switch (id) {
    case 'tag':
      body = (
        <>
          <path d="M12 20 L36 8 L56 28 L32 52 Z" fill="#FB923C" stroke="#C2410C" strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="36" cy="18" r="4" fill="#FFF7ED" stroke="#C2410C" strokeWidth="2" />
          <path d="M26 34 h12 M24 40 h10" stroke="#FFF7ED" strokeWidth="3" strokeLinecap="round" />
        </>
      );
      break;
    case 'observe':
      body = (
        <>
          <circle cx="26" cy="26" r="16" fill="#E0F2FE" stroke="#0369A1" strokeWidth="5" />
          <path d="M38 38 L54 54" stroke="#0369A1" strokeWidth="7" strokeLinecap="round" />
          <path d="M18 30 q4 -8 8 0 q4 8 8 0" stroke="#0284C7" strokeWidth="2.5" fill="none" />
        </>
      );
      break;
    case 'palpate':
      body = (
        <path
          d="M18 56 Q10 44 12 32 L14 20 q1 -5 5 -4 q4 1 4 6 L23 30 L24 12 q1 -5 5 -5 q4 0 4 5 L33 28 L35 10 q1 -5 5 -4 q4 1 4 6 L43 30 L46 18 q2 -4 5 -3 q4 2 3 6 L52 38 Q50 54 36 58 Z"
          fill="#BAE6FD"
          stroke="#0369A1"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      );
      break;
    case 'xray':
      body = (
        <>
          <rect x="14" y="6" width="36" height="22" rx="5" fill={`url(#${g})`} stroke="#475569" strokeWidth="2" />
          <path d="M22 28 L42 28 L50 46 L14 46 Z" fill="#E2E8F0" stroke="#475569" strokeWidth="2" />
          <path d="M20 52 L44 52" stroke="#38BDF8" strokeWidth="3" strokeDasharray="4 3" />
          <circle cx="32" cy="17" r="5" fill="#FDE68A" />
          <defs>{metal(g)}</defs>
        </>
      );
      break;
    case 'chart':
      body = (
        <>
          <rect x="12" y="10" width="40" height="48" rx="5" fill="#FFFFFF" stroke="#475569" strokeWidth="2.5" />
          <rect x="22" y="5" width="20" height="10" rx="3" fill="#94A3B8" />
          <path d="M20 26 h24 M20 34 h24 M20 42 h16" stroke="#0284C7" strokeWidth="3" strokeLinecap="round" />
        </>
      );
      break;
    case 'grasp':
      body = (
        <>
          <path d="M10 40 L30 28 L38 34 L54 22" stroke={`url(#${g})`} strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M22 50 q10 -26 30 -30" stroke="#38BDF8" strokeWidth="2.5" fill="none" strokeDasharray="3 3" />
          <path d="M48 14 l8 6 l-9 4" fill="none" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <defs>{metal(g)}</defs>
        </>
      );
      break;
    case 'clamp':
      body = (
        <>
          <path d="M14 14 Q10 26 22 30 M50 14 Q54 26 42 30" stroke={`url(#${g})`} strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M22 30 L32 44 L42 30" stroke={`url(#${g})`} strokeWidth="6" fill="none" strokeLinejoin="round" />
          <rect x="28" y="42" width="8" height="18" rx="3" fill="#64748B" />
          <defs>{metal(g)}</defs>
        </>
      );
      break;
    case 'plate':
      body = (
        <>
          <rect x="6" y="24" width="52" height="16" rx="8" fill={`url(#${g})`} stroke="#0369A1" strokeWidth="2" />
          {[14, 26, 38, 50].map((cx) => (
            <circle key={cx} cx={cx} cy="32" r="3.6" fill="#0B1924" stroke="#E0F2FE" strokeWidth="1.5" />
          ))}
          <defs>{ti(g)}</defs>
        </>
      );
      break;
    case 'drill':
      body = (
        <>
          <path d="M8 22 h30 q6 0 6 6 v4 q0 6 -6 6 h-30 z" fill={`url(#${g})`} stroke="#0369A1" strokeWidth="2" />
          <path d="M18 38 l-4 18 h10 l4 -18" fill="#334155" />
          <path d="M44 30 h14" stroke="#94A3B8" strokeWidth="3" />
          <path d="M46 27 l2 6 l2 -6 l2 6 l2 -6 l2 6" stroke="#64748B" strokeWidth="1.5" fill="none" />
          <defs>{ti(g)}</defs>
        </>
      );
      break;
    case 'gauge':
      body = (
        <>
          <rect x="8" y="26" width="48" height="10" rx="3" fill={`url(#${g})`} stroke="#475569" strokeWidth="2" />
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1={12 + i * 5} y1="26" x2={12 + i * 5} y2={i % 2 ? 22 : 18} stroke="#475569" strokeWidth="1.5" />
          ))}
          <path d="M50 36 v14 l4 4" stroke="#F97316" strokeWidth="3" fill="none" strokeLinecap="round" />
          <defs>{metal(g)}</defs>
        </>
      );
      break;
    case 'screw':
      body = (
        <>
          <circle cx="32" cy="14" r="9" fill="#FACC15" stroke="#A16207" strokeWidth="2" />
          <path d="M27 14 h10" stroke="#A16207" strokeWidth="2.5" />
          <path d="M28 22 h8 l-1 30 l-3 6 l-3 -6 z" fill={`url(#${g})`} stroke="#475569" strokeWidth="1.5" />
          {[28, 34, 40, 46].map((yy) => (
            <path key={yy} d={`M27 ${yy} l10 3`} stroke="#64748B" strokeWidth="1.5" />
          ))}
          <defs>{metal(g)}</defs>
        </>
      );
      break;
    case 'carm':
      body = (
        <>
          <path d="M16 12 Q4 32 16 52" stroke={`url(#${g})`} strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M16 12 h28 M16 52 h28" stroke={`url(#${g})`} strokeWidth="8" strokeLinecap="round" />
          <rect x="38" y="6" width="16" height="12" rx="3" fill="#475569" />
          <rect x="38" y="46" width="16" height="12" rx="3" fill="#475569" />
          <path d="M46 20 v24" stroke="#38BDF8" strokeWidth="2.5" strokeDasharray="3 3" />
          <defs>{metal(g)}</defs>
        </>
      );
      break;
  }
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden focusable="false">
      {body}
    </svg>
  );
}
