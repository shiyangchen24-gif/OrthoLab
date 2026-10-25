// Raster scene layers for the clinic (hand-painted PNG drop-ins).
//
// Each slot is a separate layer placed in scene coordinates (the clinic SVG
// viewBox, 1600 × 900), so images, hit zones and tools scale together and
// nothing is positioned in screen pixels. A slot renders its PNG when the file
// exists in src/assets/scene/; otherwise the scene draws the vector fallback.
// Text, buttons, highlights and the tool tray are never baked into these images.

export interface SceneSlot {
  file: string;
  /** placement box in scene units; images keep aspect ratio and sit on the box bottom */
  rect: { x: number; y: number; width: number; height: number };
  /** expected canvas size of the delivered PNG (same aspect ratio as rect) */
  canvas: { width: number; height: number };
  note: string;
  /** people: rows of the canvas the figure spans (head top / shoe soles) */
  figure?: { top: number; bottom: number };
  /** table: canvas row where the patient's paws sit */
  seatY?: number;
  source: string;
  license: string;
}

const generated = { source: '使用者以 ChatGPT 生成（OrthoLab 依規格裁切、縮放、對齊）', license: '由 ChatGPT 生成，使用者提供' };

export const SCENE_SLOTS = {
  background: { file: 'clinic-room.png', rect: { x: 0, y: 0, width: 1600, height: 900 }, canvas: { width: 1536, height: 864 }, note: '牆面、櫃體、窗戶、植栽與用品；低對比、低細節；不含人物、檢查台、文字；地板線約在 70% 高度', ...generated },
  owner: { file: 'owner.png', rect: { x: 183, y: 100, width: 314, height: 600 }, canvas: { width: 660, height: 1260 }, figure: { top: 16, bottom: 1257 }, note: '飼主全身站姿，透明背景，腳底貼齊畫布底部；場景中以半身構圖顯示', ...generated },
  vet: { file: 'vet.png', rect: { x: 1183, y: 100, width: 314, height: 600 }, canvas: { width: 660, height: 1260 }, figure: { top: 16, bottom: 1257 }, note: '獸醫全身站姿，透明背景，腳底貼齊畫布底部；場景中以半身構圖顯示', ...generated },
  table: { file: 'exam-table.png', rect: { x: 460, y: 432, width: 720, height: 480 }, canvas: { width: 1536, height: 1024 }, seatY: 190, note: '檢查台（台面＋金屬腳架），透明背景；病患腳掌落在畫布 y = 190 的台面上', ...generated },
} satisfies Record<string, SceneSlot>;

export type SceneSlotId = keyof typeof SCENE_SLOTS;

const BUNDLED: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/scene/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>).map(([k, v]) => [
    k.replace('../assets/scene/', ''),
    v,
  ]),
);

export function sceneImage(id: SceneSlotId, files: Record<string, string> = BUNDLED): string | null {
  return files[SCENE_SLOTS[id].file] ?? null;
}

export function missingSceneArt(files: Record<string, string> = BUNDLED): string[] {
  return Object.values(SCENE_SLOTS)
    .filter((s) => !files[s.file])
    .map((s) => `src/assets/scene/${s.file}`);
}
