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
  /** expected canvas size of the delivered PNG (3 × rect) */
  canvas: { width: number; height: number };
  note: string;
  source: string;
  license: string;
}

const pending = { source: '待製作（原創手繪風格，配色：暖白、霧藍、鼠尾草綠、淡青；左上方柔光）', license: '待確認' };

export const SCENE_SLOTS = {
  background: { file: 'clinic-room.png', rect: { x: 0, y: 0, width: 1600, height: 900 }, canvas: { width: 4800, height: 2700 }, note: '牆面、櫃體、窗戶、植栽與用品；低對比、低細節；不含人物、檢查台、文字', ...pending },
  owner: { file: 'owner.png', rect: { x: 230, y: 250, width: 220, height: 420 }, canvas: { width: 660, height: 1260 }, note: '飼主全身站姿，透明背景，腳底貼齊畫布底部', ...pending },
  vet: { file: 'vet.png', rect: { x: 1230, y: 250, width: 220, height: 420 }, canvas: { width: 660, height: 1260 }, note: '獸醫全身站姿，透明背景，腳底貼齊畫布底部', ...pending },
  table: { file: 'exam-table.png', rect: { x: 520, y: 500, width: 640, height: 230 }, canvas: { width: 1920, height: 690 }, note: '檢查台（柔和材質），台面上緣位於畫布 y = 60（場景 y = 520）', ...pending },
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
