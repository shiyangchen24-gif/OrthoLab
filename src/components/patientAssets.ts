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

/** rest / lifted / palpation-withdrawal poses, plus a post-op bandaged pose used by the care stage */
export type PoseKey = 'sit' | `lift-${Limb}` | `withdraw-${Limb}` | `bandaged-${Limb}`;

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
    poses: { sit: 'sit.png', 'lift-LF': 'lift-LF.png', 'withdraw-LF': 'withdraw-LF.png', 'bandaged-LF': 'bandaged-LF.png' },
    // measured on the delivered art (viewBox units = canvas px / 3)
    limbBoxes: {
      sit: { RF: { x: 106, y: 200, width: 50, height: 134 }, LF: { x: 156, y: 200, width: 50, height: 134 }, RH: { x: 64, y: 258, width: 46, height: 74 }, LH: { x: 206, y: 262, width: 48, height: 70 } },
      'lift-LF': { RF: { x: 106, y: 200, width: 52, height: 134 }, LF: { x: 172, y: 194, width: 64, height: 74 }, RH: { x: 64, y: 258, width: 46, height: 74 }, LH: { x: 198, y: 272, width: 60, height: 60 } },
      'bandaged-LF': { RF: { x: 106, y: 200, width: 50, height: 134 }, LF: { x: 156, y: 200, width: 50, height: 134 }, RH: { x: 64, y: 258, width: 46, height: 74 }, LH: { x: 206, y: 262, width: 48, height: 70 } },
      'withdraw-LF': { RF: { x: 106, y: 200, width: 52, height: 134 }, LF: { x: 168, y: 188, width: 64, height: 70 }, RH: { x: 64, y: 258, width: 46, height: 74 }, LH: { x: 198, y: 272, width: 60, height: 60 } },
    },
    bodyBox: { x: 84, y: 22, width: 170, height: 232 },
    source: '使用者以 ChatGPT 生成三個對齊姿態（OrthoLab 依規格縮放並對齊腳掌基線）',
    license: '由 ChatGPT 生成，使用者提供',
    status: 'delivered',
  },
  // other cases: registered so their poses drop in; boxes are placeholders until measured on the delivered art
  pending('labrador', '犬', ['拉布拉多'], 'LH', 'C01'),
  pending('toy-poodle', '犬', ['玩具貴賓'], 'LH', 'C02'),
  pending('yorkshire', '犬', ['約克夏'], 'RH', 'C03'),
  pending('pomeranian', '犬', ['博美'], 'RH', 'C04'),
  pending('mixed-dog', '犬', ['米克斯'], 'LH', 'C05', { lift: false }),
  pending('grey-tabby', '貓', ['短毛家貓'], null, 'C06'),
  pending('orange-cat', '貓', ['米克斯（短毛貓）'], 'RH', 'C08'),
];

/**
 * A character whose art has not been delivered yet. `limb` is the case's single affected limb
 * (null = bilateral: seated only); `lift: false` = the case shows no lameness (asymptomatic).
 */
function pending(id: string, species: Species, breeds: string[], limb: Limb | null, caseId: string, opts: { lift?: boolean } = {}): CharacterArtSpec {
  const sit: Record<Limb, HitBox> = {
    RF: { x: 106, y: 200, width: 50, height: 134 },
    LF: { x: 156, y: 200, width: 50, height: 134 },
    RH: { x: 64, y: 258, width: 46, height: 74 },
    LH: { x: 206, y: 262, width: 48, height: 70 },
  };
  const poses: Partial<Record<PoseKey, string>> = { sit: 'sit.png' };
  const limbBoxes: Partial<Record<PoseKey, Record<Limb, HitBox>>> = { sit };
  if (limb) {
    const keys: PoseKey[] = [...(opts.lift === false ? [] : [`lift-${limb}` as PoseKey]), `withdraw-${limb}`, `bandaged-${limb}`];
    for (const k of keys) {
      poses[k] = `${k}.png`;
      limbBoxes[k] = sit;
    }
  }
  return {
    id,
    species,
    breeds,
    dir: id,
    view: 'three-quarter-front',
    screenRight: 'patient-left',
    canvas: { ...ART_CANVAS },
    baseline: { x: 510, y: 1002 },
    poses,
    limbBoxes,
    bodyBox: { x: 84, y: 22, width: 170, height: 232 },
    source: `待提供：${caseId} 角色姿態（以病例頭像為角色參考，ChatGPT 生成）`,
    license: '待確認',
    status: 'pending',
  };
}

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
