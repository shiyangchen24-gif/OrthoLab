// Painted page illustrations (home, care, guide, knowledge base, references).
// Processed copies of the originals in art-inbox/ live in src/assets/illust/;
// every image is decorative or captioned by the page, and a missing file just
// leaves the page in its text layout.

const FILES: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/illust/**/*.{webp,png}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>).map(([k, v]) => [
    k.replace('../assets/illust/', '').replace(/\.(webp|png)$/, ''),
    v,
  ]),
);

export const ILLUST_SOURCE = { source: '使用者以 ChatGPT 生成（OrthoLab 縮放、壓縮）', license: '由 ChatGPT 生成，使用者提供' } as const;

/** URL of an illustration such as 'care/wound', or null when it has not been delivered. */
export function illust(path: string): string | null {
  return FILES[path] ?? null;
}
