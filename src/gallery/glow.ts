import type { DaySpec } from '../types/dayspec';

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function toHsl(hex: string): Hsl | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return { h, s, l };
}

function toHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  const hex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return '#' + hex(r) + hex(g) + hex(b);
}

/** Насыщенность цвета с поправкой на то, что почти белые и почти чёрные цвета её не показывают. */
function chroma(c: Hsl) {
  return c.s * (1 - Math.abs(2 * c.l - 1));
}

/**
 * Свечение дня: самый выраженный цвет его снимков (краска, тени, света), поднятый до яркого.
 * Серые снимки дают холодное серебристое свечение, а не выдуманный цвет.
 */
export function dayGlow(
  spec: Pick<DaySpec, 'ink' | 'duo'> & Partial<Pick<DaySpec, 'page'>>,
): string {
  // Цвет, который автор выбрал сам, не подправляем.
  const own = spec.page?.sheet?.scene.glow;
  if (own) return own;
  const colors = [spec.ink, spec.duo[0], spec.duo[1]]
    .map(toHsl)
    .filter((c): c is Hsl => c !== null);
  if (!colors.length) return '#8fd3c8';
  const best = colors.reduce((a, b) => (chroma(b) > chroma(a) ? b : a));
  if (chroma(best) < 0.06) return toHex({ h: 215, s: 0.18, l: 0.62 });
  return toHex({ h: best.h, s: Math.max(0.68, Math.min(0.9, best.s)), l: 0.55 });
}

/** Интервал между долями песни, с: по нему дышит свечение, пока играет звук. */
export function beatSeconds(beats: number[]): number {
  const gaps = beats
    .slice(1)
    .map((b, i) => b - beats[i])
    .filter((g) => g > 0.2 && g < 2)
    .sort((a, b) => a - b);
  return gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0.75;
}
