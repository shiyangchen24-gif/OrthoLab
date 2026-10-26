// Painted case portraits (case list). Neutral, four-paws-down poses so the
// card never reveals the affected limb before the player localises it.
// Drop-in: src/assets/portraits/<caseId>.png (512 × 512, transparent, paws on
// a common baseline). A case without a portrait keeps the vector patient.

import type { ReactNode } from 'react';
import type { Species } from '../types';

const BUNDLED: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/portraits/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>).map(([k, v]) => [
    k.replace('../assets/portraits/', '').replace('.png', ''),
    v,
  ]),
);

export const PORTRAIT_SOURCE = { source: '使用者以 ChatGPT 生成（OrthoLab 裁切、縮放並對齊腳掌基線）', license: '由 ChatGPT 生成，使用者提供' } as const;

export function portraitFor(caseId: string, files: Record<string, string> = BUNDLED): string | null {
  return files[caseId] ?? null;
}

export function CasePortrait({ caseId, species, breed, size, fallback }: { caseId: string; species: Species; breed: string; size: number; fallback: ReactNode }) {
  const url = portraitFor(caseId);
  if (!url) return <>{fallback}</>;
  return <img className="case-portrait" src={url} width={size} height={size} alt={`${breed}（${species}）病例頭像，教學插畫`} loading="lazy" decoding="async" data-testid={`portrait-${caseId}`} />;
}
