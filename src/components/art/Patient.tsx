import type { PatientPose, Species } from '../../types';

// Layered flat-vector patients. Discomfort is shown with a lifted limb,
// ears back and squinting eyes — never blood or distress.

export interface PatientProps {
  species: Species;
  breed: string;
  pose: PatientPose;
  /** "左" / "右" in the affected-side text decides which flank faces the viewer. */
  side: string;
  size?: number;
  label?: string;
}

const COATS: Record<string, { body: string; dark: string; light: string }> = {
  拉布拉多: { body: '#E8C27A', dark: '#C9A05A', light: '#F5DDA8' },
  玩具貴賓: { body: '#D9A066', dark: '#B97F45', light: '#EEC594' },
  約克夏: { body: '#C99A5B', dark: '#5B4B3E', light: '#E2BE86' },
  博美: { body: '#F0A64B', dark: '#D0842C', light: '#FAD09A' },
  米克斯: { body: '#B98B5E', dark: '#94693F', light: '#DDBB95' },
  瑪爾濟斯: { body: '#FAF7F2', dark: '#DCD3C6', light: '#FFFFFF' },
  短毛家貓: { body: '#9CA3AF', dark: '#6B7280', light: '#D1D5DB' },
  '米克斯（短毛貓）': { body: '#E8A15C', dark: '#C47A35', light: '#F6CC9C' },
};

export function Patient({ species, breed, pose, side, size = 220, label }: PatientProps) {
  const coat = COATS[breed] ?? (species === '貓' ? COATS['短毛家貓'] : COATS['米克斯']);
  // Facing right shows the left flank; mirror for right-sided problems.
  const mirror = side.includes('右');
  const uncomfortable = pose !== 'stand-alert';
  const title = label ?? `${species}（${breed}）${uncomfortable ? '，呈現不適姿態' : '，姿態正常'}`;
  return (
    <svg viewBox="0 0 240 170" width={size} height={(size * 170) / 240} role="img" aria-label={title}>
      <title>{title}</title>
      <ellipse cx="120" cy="152" rx="80" ry="8" fill="#0F172A" opacity=".08" />
      <g transform={mirror ? 'translate(240 0) scale(-1 1)' : undefined}>
        {species === '貓' ? <Cat coat={coat} pose={pose} uncomfortable={uncomfortable} /> : <Dog coat={coat} pose={pose} uncomfortable={uncomfortable} breed={breed} />}
      </g>
    </svg>
  );
}

type Coat = { body: string; dark: string; light: string };

function Leg({ x, y, h, fill, lifted = false, bend = 0, cls }: { x: number; y: number; h: number; fill: string; lifted?: boolean; bend?: number; cls?: string }) {
  // a leg hanging from (x, y); lifted legs rotate at the joint and clear the floor
  const rot = lifted ? bend : 0;
  return (
    <g transform={`rotate(${rot} ${x} ${y})`} className={lifted ? cls : undefined}>
      <rect x={x - 6} y={y} width="12" height={h} rx="6" fill={fill} stroke="#7C5A3A" strokeOpacity=".25" strokeWidth="2" />
      <ellipse cx={x + 2} cy={y + h} rx="8" ry="4.5" fill={fill} stroke="#7C5A3A" strokeOpacity=".25" strokeWidth="2" />
    </g>
  );
}

function Eye({ x, y, squint }: { x: number; y: number; squint: boolean }) {
  return squint ? (
    <path d={`M${x - 4} ${y} q4 3 8 0`} stroke="#1F2937" strokeWidth="2.2" fill="none" strokeLinecap="round" />
  ) : (
    <g>
      <circle cx={x} cy={y} r="3.6" fill="#1F2937" />
      <circle cx={x + 1.2} cy={y - 1.2} r="1.1" fill="#fff" />
    </g>
  );
}

function Dog({ coat, pose, uncomfortable, breed }: { coat: Coat; pose: PatientPose; uncomfortable: boolean; breed: string }) {
  const hindLift = pose === 'hind-lift';
  const foreLift = pose === 'fore-lift';
  const curly = breed === '玩具貴賓' || breed === '博美';
  return (
    <g strokeLinejoin="round">
      {/* tail */}
      <path className="anim-tail" d={uncomfortable ? 'M58 86 q-22 6 -30 22' : 'M58 80 q-18 -10 -22 -34'} stroke={coat.dark} strokeWidth="9" fill="none" strokeLinecap="round" />
      {/* far legs */}
      <Leg x={150} y={98} h={40} fill={coat.dark} />
      <Leg x={74} y={98} h={40} fill={coat.dark} />
      {/* body */}
      <g className="anim-breathe">
        <ellipse cx="110" cy="88" rx="56" ry="28" fill={coat.body} stroke="#7C5A3A" strokeOpacity=".3" strokeWidth="2" />
        <ellipse cx="112" cy="98" rx="40" ry="14" fill={coat.light} opacity=".7" />
        {curly && [70, 90, 110, 130, 150].map((x) => <circle key={x} cx={x} cy={68} r="9" fill={coat.light} opacity=".6" />)}
      </g>
      {/* near legs */}
      <Leg x={154} y={102} h={38} fill={coat.body} lifted={foreLift} bend={-48} cls="anim-limb" />
      <Leg x={80} y={102} h={38} fill={coat.body} lifted={hindLift} bend={28} cls="anim-limb" />
      {/* head */}
      <g transform={uncomfortable ? 'rotate(6 168 62)' : undefined}>
        <rect x="150" y="66" width="18" height="24" rx="8" fill={coat.body} />
        <circle cx="172" cy="58" r="23" fill={coat.body} stroke="#7C5A3A" strokeOpacity=".3" strokeWidth="2" />
        <ellipse cx="192" cy="68" rx="15" ry="10.5" fill={coat.light} stroke="#7C5A3A" strokeOpacity=".25" strokeWidth="2" />
        <ellipse cx="205" cy="64" rx="4.5" ry="3.8" fill="#1F2937" />
        <path d="M193 76 q5 3 10 0" stroke="#7C5A3A" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <Eye x={179} y={53} squint={uncomfortable} />
        {/* ear: flops back when uncomfortable */}
        <path
          className="anim-ear"
          d={uncomfortable ? 'M164 40 q-22 2 -26 22 q12 4 22 -6 z' : 'M162 38 q-6 22 4 34 q10 -10 8 -30 z'}
          fill={coat.dark}
        />
        {/* collar */}
        <rect x="148" y="78" width="22" height="7" rx="3.5" fill="#0284C7" />
        <circle cx="160" cy="88" r="3.5" fill="#F97316" />
      </g>
    </g>
  );
}

function Cat({ coat, pose, uncomfortable }: { coat: Coat; pose: PatientPose; uncomfortable: boolean }) {
  if (pose === 'sit-stiff') {
    return (
      <g strokeLinejoin="round">
        <path className="anim-tail" d="M86 140 q-40 4 -40 -26" stroke={coat.dark} strokeWidth="8" fill="none" strokeLinecap="round" />
        <g className="anim-breathe">
          <ellipse cx="110" cy="110" rx="34" ry="36" fill={coat.body} stroke="#4B5563" strokeOpacity=".3" strokeWidth="2" />
          <ellipse cx="92" cy="128" rx="20" ry="16" fill={coat.dark} opacity=".55" />
          <ellipse cx="118" cy="114" rx="18" ry="24" fill={coat.light} opacity=".6" />
        </g>
        <rect x="118" y="112" width="10" height="34" rx="5" fill={coat.body} stroke="#4B5563" strokeOpacity=".25" strokeWidth="2" />
        <rect x="132" y="112" width="10" height="34" rx="5" fill={coat.body} stroke="#4B5563" strokeOpacity=".25" strokeWidth="2" />
        <Head coat={coat} cx={128} cy={66} uncomfortable={uncomfortable} />
        {[96, 104].map((y) => <path key={y} d={`M88 ${y} q10 4 20 0`} stroke={coat.dark} strokeWidth="3" fill="none" opacity=".6" />)}
      </g>
    );
  }
  const crouch = pose === 'crouch';
  const dy = crouch ? 14 : 0;
  return (
    <g strokeLinejoin="round" transform={`translate(0 ${dy})`}>
      <path className="anim-tail" d={crouch ? 'M60 92 q-30 8 -34 30' : 'M60 84 q-30 -14 -26 -46'} stroke={coat.dark} strokeWidth="8" fill="none" strokeLinecap="round" />
      <Leg x={146} y={98} h={crouch ? 26 : 38} fill={coat.dark} />
      <Leg x={76} y={98} h={crouch ? 26 : 38} fill={coat.dark} />
      <g className="anim-breathe">
        <ellipse cx="110" cy="88" rx="52" ry="24" fill={coat.body} stroke="#4B5563" strokeOpacity=".3" strokeWidth="2" />
        <ellipse cx="112" cy="98" rx="36" ry="11" fill={coat.light} opacity=".7" />
        {[82, 100, 118].map((x) => <path key={x} d={`M${x} 66 q4 10 0 18`} stroke={coat.dark} strokeWidth="4" fill="none" opacity=".5" />)}
      </g>
      <Leg x={150} y={100} h={crouch ? 26 : 38} fill={coat.body} />
      {/* near hind limb held off the ground in protective crouch */}
      <Leg x={80} y={100} h={crouch ? 24 : 38} fill={coat.body} lifted={crouch} bend={52} cls="anim-limb" />
      <Head coat={coat} cx={166} cy={crouch ? 66 : 58} uncomfortable={uncomfortable} />
    </g>
  );
}

function Head({ coat, cx, cy, uncomfortable }: { coat: Coat; cx: number; cy: number; uncomfortable: boolean }) {
  const earBack = uncomfortable ? 10 : 0;
  return (
    <g>
      <path className="anim-ear" d={`M${cx - 18} ${cy - 10} l${-4 + earBack / 2} ${-22 + earBack} l16 10 z`} fill={coat.dark} />
      <path className="anim-ear" d={`M${cx + 4} ${cy - 16} l${8 - earBack / 2} ${-20 + earBack} l8 22 z`} fill={coat.dark} />
      <circle cx={cx} cy={cy} r="21" fill={coat.body} stroke="#4B5563" strokeOpacity=".3" strokeWidth="2" />
      <ellipse cx={cx + 10} cy={cy + 8} rx="10" ry="7" fill={coat.light} />
      <path d={`M${cx + 14} ${cy + 3} l4 0 l-2 3 z`} fill="#F472B6" />
      <Eye x={cx + 2} y={cy - 4} squint={uncomfortable} />
      <Eye x={cx + 15} y={cy - 4} squint={uncomfortable} />
      {[-2, 2].map((d) => (
        <path key={d} d={`M${cx + 18} ${cy + 8 + d} l16 ${d * 2}`} stroke="#4B5563" strokeWidth="1" opacity=".6" />
      ))}
    </g>
  );
}
