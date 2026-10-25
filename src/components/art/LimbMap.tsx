import type { Limb } from '../../data/caseMeta';
import { LIMB_LABEL } from '../../data/caseMeta';
import type { Species } from '../../types';

// Dorsal (top-down) view, head pointing up: the patient's LEFT is on the
// viewer's LEFT. This avoids the mirror ambiguity of a side view, where far
// and near limbs overlap. The real answer is never highlighted before the
// player has answered correctly.

const LIMBS: { id: Limb; x: number; y: number }[] = [
  { id: 'LF', x: 38, y: 62 },
  { id: 'RF', x: 122, y: 62 },
  { id: 'LH', x: 42, y: 162 },
  { id: 'RH', x: 118, y: 162 },
];

export function LimbMap({
  species,
  selected,
  confirmed,
  onToggle,
  disabled,
}: {
  species: Species;
  selected: Limb[];
  /** limbs to highlight as the confirmed answer (only after a correct answer) */
  confirmed: Limb[];
  onToggle: (l: Limb) => void;
  disabled?: boolean;
}) {
  const cat = species === '貓';
  return (
    <svg viewBox="0 0 160 230" className="limb-map" role="group" aria-label="患肢定位：俯視圖，頭朝上，病患左側在畫面左側" data-guide="limb">
      <text x="80" y="10" fontSize="8" textAnchor="middle" fill="#64748B">頭 ↑（俯視）</text>
      <text x="6" y="118" fontSize="9" fill="#0369A1" fontWeight="700">左</text>
      <text x="146" y="118" fontSize="9" fill="#0369A1" fontWeight="700">右</text>
      {/* tail */}
      <path d={cat ? 'M80 196 q22 18 8 32' : 'M80 196 q4 14 0 24'} stroke="#CBD5E1" strokeWidth={cat ? 6 : 8} fill="none" strokeLinecap="round" />
      {/* limbs */}
      {LIMBS.map((l) => {
        const on = selected.includes(l.id);
        const ok = confirmed.includes(l.id);
        return (
          <g
            key={l.id}
            className="limb"
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-pressed={on}
            aria-label={`${LIMB_LABEL[l.id]}${ok ? '（已確認患肢）' : ''}`}
            onClick={() => !disabled && onToggle(l.id)}
            onKeyDown={(e) => {
              if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onToggle(l.id);
              }
            }}
            data-testid={`limb-${l.id}`}
          >
            <rect x={l.x - 14} y={l.y - 26} width="28" height="52" rx="13" fill={ok ? '#FDBA74' : on ? '#BAE6FD' : '#E2E8F0'} stroke={ok ? '#F97316' : on ? '#0284C7' : '#94A3B8'} strokeWidth="2" />
            <text x={l.x} y={l.y + 4} fontSize="8.5" textAnchor="middle" fill="#0F172A" fontWeight="700" pointerEvents="none">
              {LIMB_LABEL[l.id].replace('肢', '')}
            </text>
          </g>
        );
      })}
      {/* body + head */}
      <ellipse cx="80" cy="115" rx="34" ry="76" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="2" pointerEvents="none" />
      <circle cx="80" cy="34" r={cat ? 19 : 21} fill="#F1F5F9" stroke="#94A3B8" strokeWidth="2" pointerEvents="none" />
      {cat ? (
        <path d="M64 24 l-3 -14 l12 8 z M96 24 l3 -14 l-12 8 z" fill="#CBD5E1" pointerEvents="none" />
      ) : (
        <path d="M60 30 q-10 8 -4 22 q6 -4 8 -14 z M100 30 q10 8 4 22 q-6 -4 -8 -14 z" fill="#CBD5E1" pointerEvents="none" />
      )}
      <circle cx="80" cy="18" r="3" fill="#475569" pointerEvents="none" />
    </svg>
  );
}
