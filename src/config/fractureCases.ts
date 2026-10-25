// T09 teaching-model geometry for C07 and C08, in model millimetres.
// All dimensions are game-model settings chosen so the case data (fracture
// type, side, displacement) can be represented. They are NOT anatomical
// measurements and must not be read as implant-sizing rules.

import type { Segment, Vec } from '../engine/geometry';

export type ViewKey = 'primary' | 'secondary';

export interface PlateOption {
  id: string;
  label: string;
  holes: number;
  spacing: number;
  endPad: number;
  isPreset: boolean;
  /** Preset screw configuration for this case (hole indices), only for the preset plate. */
  presetHoles: number[];
}

export interface ClampPoint {
  id: string;
  label: string;
  at: Vec;
  side: 'proximal' | 'distal';
  onPlatePath: boolean;
}

export interface FractureModel {
  caseId: string;
  boneName: string;
  sideLabel: 'L' | 'R';
  /** Bone length along the x axis. */
  length: number;
  /** Width profile control points (x, width); linear interpolation. */
  profile: [number, number][];
  /** Fracture line passes through (x, 0); angle from perpendicular in degrees. */
  fracture: { x: number; obliquityDeg: number; label: string };
  /** Articular / bone-end surfaces used for clearance checks. */
  articular: Segment[];
  views: Record<ViewKey, { label: string; projection: string; plateFace: 'profile' | 'face' }>;
  /** Plate sits on the top surface (y < 0) of the primary view = tension side. */
  tensionSideLabel: string;
  compressionSideLabel: string;
  initial: { dx: number; views: Record<ViewKey, { dy: number; theta: number }> };
  plateSystemLabel: string;
  plates: PlateOption[];
  screwLengths: number[];
  clampPoints: ClampPoint[];
  /** Decorative companion bone (ulna) drawn in views, not scored. */
  companion?: { offsetY: number; width: number; label: string };
  /** For the X-ray schematic: px per model mm is defined by the SVG viewBox (1 unit = 1 mm). */
  notes: string[];
}

export const FRACTURE_MODELS: Record<string, FractureModel> = {
  C07: {
    caseId: 'C07',
    boneName: '左橈骨（示意）',
    sideLabel: 'L',
    length: 80,
    profile: [
      [0, 8],
      [6, 6.2],
      [64, 6],
      [77, 9],
      [80, 9.5],
    ],
    fracture: { x: 56, obliquityDeg: 0, label: '遠端 1/3 橫斷骨折' },
    articular: [
      { a: { x: 0, y: -4 }, b: { x: 0, y: 4 } },
      { a: { x: 78, y: -4.75 }, b: { x: 80, y: 4.75 } },
    ],
    views: {
      primary: { label: 'Lat 側位', projection: '外內側投照（Lat）', plateFace: 'profile' },
      secondary: { label: 'AP 前後位', projection: '前後投照（AP／CrCd）', plateFace: 'face' },
    },
    tensionSideLabel: '背側（張力側）',
    compressionSideLabel: '掌側（壓力側）',
    // 18° dorsomedial angulation decomposed into two planes (game assumption):
    // dorsal 14° (Lat) and medial 11° (AP); √(14²+11²) ≈ 17.8°. Overlap 3 mm.
    initial: { dx: -3, views: { primary: { dy: 1.2, theta: 14 }, secondary: { dy: -0.8, theta: -11 } } },
    plateSystemLabel: '2.0 mm 系統示意骨板（依本病例資料設定）',
    plates: [
      { id: 'c07-p6', label: '示意骨板 6 孔', holes: 6, spacing: 5.5, endPad: 4, isPreset: false, presetHoles: [] },
      { id: 'c07-p12', label: '示意骨板 12 孔（本病例預設）', holes: 12, spacing: 5.5, endPad: 4, isPreset: true, presetHoles: [1, 3, 5, 9, 10, 11] },
      { id: 'c07-p14', label: '示意骨板 14 孔', holes: 14, spacing: 5.5, endPad: 4, isPreset: false, presetHoles: [] },
    ],
    screwLengths: [4, 6, 7, 8, 10, 12],
    clampPoints: [
      { id: 'px-top', label: '近端・背側', at: { x: 50, y: -3 }, side: 'proximal', onPlatePath: true },
      { id: 'px-bot', label: '近端・掌側', at: { x: 50, y: 3 }, side: 'proximal', onPlatePath: false },
      { id: 'ds-top', label: '遠端・背側', at: { x: 62, y: -3 }, side: 'distal', onPlatePath: true },
      { id: 'ds-bot', label: '遠端・掌側', at: { x: 62, y: 3.1 }, side: 'distal', onPlatePath: false },
    ],
    companion: { offsetY: 9, width: 3.2, label: '尺骨（示意，不計分）' },
    notes: ['生長板已閉合（依 C07-E3），本模型不另設生長板避讓區。', '橈骨與尺骨均骨折；本模組只固定橈骨。'],
  },
  C08: {
    caseId: 'C08',
    boneName: '右股骨（示意）',
    sideLabel: 'R',
    length: 100,
    profile: [
      [0, 14],
      [12, 10.5],
      [80, 10],
      [92, 14],
      [100, 15],
    ],
    fracture: { x: 50, obliquityDeg: 30, label: '骨幹中段短斜骨折' },
    articular: [
      { a: { x: 0, y: -7 }, b: { x: 0, y: 7 } },
      { a: { x: 97, y: -7.5 }, b: { x: 100, y: 7.5 } },
    ],
    views: {
      primary: { label: 'AP 前後位', projection: '前後投照（CrCd），外側骨板呈側面', plateFace: 'profile' },
      secondary: { label: 'Lat 側位', projection: '外內側投照（Lat），骨板呈正面', plateFace: 'face' },
    },
    tensionSideLabel: '外側（張力側）',
    compressionSideLabel: '內側（壓力側）',
    // 15° lateral angulation (AP) and 12 mm overlap from C08-E3. The Lat-plane
    // 1.5 mm translation is a game assumption so both views need checking.
    initial: { dx: -12, views: { primary: { dy: 3, theta: 15 }, secondary: { dy: 1.5, theta: 0 } } },
    plateSystemLabel: '2.7 mm 系統示意骨板（依本病例資料設定）',
    plates: [
      { id: 'c08-p8', label: '示意骨板 8 孔', holes: 8, spacing: 7, endPad: 4, isPreset: false, presetHoles: [] },
      { id: 'c08-p12', label: '示意骨板 12 孔（本病例預設）', holes: 12, spacing: 7, endPad: 4, isPreset: true, presetHoles: [0, 2, 4, 7, 9, 11] },
      { id: 'c08-p14', label: '示意骨板 14 孔', holes: 14, spacing: 7, endPad: 4, isPreset: false, presetHoles: [] },
    ],
    screwLengths: [8, 10, 11, 12, 14, 16],
    clampPoints: [
      { id: 'px-top', label: '近端・外側', at: { x: 40, y: -5 }, side: 'proximal', onPlatePath: true },
      { id: 'px-bot', label: '近端・內側', at: { x: 42, y: 5 }, side: 'proximal', onPlatePath: false },
      { id: 'ds-top', label: '遠端・外側', at: { x: 58, y: -5 }, side: 'distal', onPlatePath: true },
      { id: 'ds-bot', label: '遠端・內側', at: { x: 60, y: 5 }, side: 'distal', onPlatePath: false },
    ],
    notes: ['無粉碎骨片（依 C08-E3）。', 'Plate-Rod 複合固定未模擬。'],
  },
};

export const plateLength = (p: PlateOption) => p.endPad * 2 + p.spacing * (p.holes - 1);
export const holeOffset = (p: PlateOption, i: number) => p.endPad + p.spacing * i;
