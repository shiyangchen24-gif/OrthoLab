// Raster (hand-painted PNG) patient art: manifest + resolution.
//
// Drop-in workflow: put the PNG files named in a spec's `poses` into
// src/assets/patients/<spec.dir>/ and rebuild. Vite bundles whatever exists
// (import.meta.glob); a character switches to raster art only when its base
// pose for the case is present, otherwise PatientView keeps the vector
// fallback so nothing renders broken. `python3 scripts/check_patient_assets.py`
// validates size, transparency and edge halos before the art is committed.
//
// Coordinate contract (shared with the vector PatientView and the scenes):
//   every pose PNG is the same canvas, 1020 × 1140 px (= 3 × the 340 × 380
//   viewBox), same camera, light (upper left) and body position; the paw
//   baseline sits at canvas y = 1002 (viewBox 334) centred on x = 510.
//   Limb hit boxes below are in viewBox units, so scenes scale them together
//   with the image; nothing is placed in screen pixels.
//
// Anatomical sides: the patient faces the viewer turned slightly to the
// viewer's left, so the patient's LEFT limbs are on the SCREEN RIGHT. Images
// are never mirrored to obtain the other side; a missing side means a missing
// file, not a flipped one.

import type { Limb } from '../data/caseMeta';
import type { Species } from '../types';

export type PoseKey = 'sit' | `lift-${Limb}` | `withdraw-${Limb}`;

export interface HitBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CharacterArtSpec {
  id: string;
  species: Species;
  /** breeds this art is drawn for (case data `breed`) */
  breeds: string[];
  /** folder under src/assets/patients/ */
  dir: string;
  view: 'three-quarter-front';
  /** which anatomical side appears on the screen's right */
  screenRight: 'patient-left';
  canvas: { width: number; height: number };
  /** paw baseline and horizontal anchor, canvas px */
  baseline: { x: number; y: number };
  /** pose → file name inside `dir` */
  poses: Partial<Record<PoseKey, string>>;
  /** pose → limb hit boxes in viewBox (340 × 380) units; re-measure when the art changes */
  limbBoxes: Partial<Record<PoseKey, Record<Limb, HitBox>>>;
  /** body (torso + head) hit box, viewBox units */
  bodyBox: HitBox;
  source: string;
  license: string;
  /** 'pending' until real, licensed art has been delivered and checked */
  status: 'pending' | 'delivered';
}

export const ART_CANVAS = { width: 1020, height: 1140 } as const;
export const ART_VIEWBOX = { width: 340, height: 380 } as const;

const STANDING: Record<Limb, HitBox> = {
  RF: { x: 118, y: 208, width: 58, height: 128 },
  LF: { x: 164, y: 208, width: 58, height: 128 },
  RH: { x: 76, y: 252, width: 70, height: 84 },
  LH: { x: 194, y: 252, width: 70, height: 84 },
};

export const CHARACTER_ART: CharacterArtSpec[] = [
  {
    id: 'maltese',
    species: '犬',
    breeds: ['瑪爾濟斯'],
    dir: 'maltese',
    view: 'three-quarter-front',
    screenRight: 'patient-left',
    canvas: { ...ART_CANVAS },
    baseline: { x: 510, y: 1002 },
    poses: { sit: 'sit.png', 'lift-LF': 'lift-LF.png', 'withdraw-LF': 'withdraw-LF.png' },
    limbBoxes: {
      sit: STANDING,
      'lift-LF': { ...STANDING, LF: { x: 174, y: 208, width: 76, height: 82 } },
      'withdraw-LF': { ...STANDING, LF: { x: 170, y: 200, width: 76, height: 82 } },
    },
    bodyBox: { x: 100, y: 40, width: 140, height: 290 },
    source: '待製作：原創手繪風格素材（依使用者提供之 C07 參考圖風格，不得直接裁切參考圖）',
    license: '待確認（交付時填寫作者與授權）',
    status: 'pending',
  },
];

/** PNGs that actually exist in the bundle: "<dir>/<file>" → URL. */
const BUNDLED: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/patients/*/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>).map(([k, v]) => [
    k.replace('../assets/patients/', ''),
    v,
  ]),
);

export interface ResolvedArt {
  spec: CharacterArtSpec;
  /** pose → URL, only for files that exist */
  urls: Partial<Record<PoseKey, string>>;
}

/** Find raster art for this patient; null → use the vector fallback. */
export function resolvePatientArt(species: Species, breed: string, files: Record<string, string> = BUNDLED): ResolvedArt | null {
  const spec = CHARACTER_ART.find((a) => a.species === species && a.breeds.includes(breed));
  if (!spec) return null;
  const urls: Partial<Record<PoseKey, string>> = {};
  for (const [pose, file] of Object.entries(spec.poses) as [PoseKey, string][]) {
    const url = files[`${spec.dir}/${file}`];
    if (url) urls[pose] = url;
  }
  return Object.keys(urls).length ? { spec, urls } : null;
}

/**
 * The pose a case shows at rest, and during a palpation withdrawal.
 * Only a single raised limb gets a lifted pose; bilateral, asymptomatic and
 * unknown-side cases stay seated. The withdrawal pose exists only for a single
 * affected limb.
 */
export function posePlan(raised: readonly Limb[], affected: readonly Limb[]): { rest: PoseKey; withdraw: PoseKey | null } {
  const rest: PoseKey = raised.length === 1 ? `lift-${raised[0]}` : 'sit';
  const withdraw: PoseKey | null = affected.length === 1 ? `withdraw-${affected[0]}` : null;
  return { rest, withdraw };
}

/** Files the bundle is missing for each pending character (for docs / dev checks). */
export function missingArt(files: Record<string, string> = BUNDLED): { id: string; files: string[] }[] {
  return CHARACTER_ART.map((a) => ({ id: a.id, files: Object.values(a.poses).filter((f) => !files[`${a.dir}/${f}`]).map((f) => `src/assets/patients/${a.dir}/${f}`) })).filter((m) => m.files.length);
}
