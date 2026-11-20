/** Бумага и краска книжки: чистые функции от полей DaySpec.paper и DaySpec.ink. */

export type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb {
  const h = hex.trim().replace(/^#/, '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h.padEnd(6, '0');
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: Rgb): string {
  const c = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Относительная яркость по WCAG, 0..1. */
export function luminance(rgb: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const COLD: Rgb = parseHex('#d6e0e6');
const NEUTRAL: Rgb = parseHex('#e7e6e1');
const WARM: Rgb = parseHex('#f1e3c6');
const YELLOWED: Rgb = parseHex('#d9b878');

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Цвет бумаги: tone -1 серо-голубой … 0 нейтральный … 1 кремовый,
 * brightness 0..1 делает лист темнее или светлее, age 0..1 желтит.
 */
export function toneColor(tone: number, brightness = 0.6, age = 0): string {
  const t = clamp(tone, -1, 1);
  const base = t < 0 ? mix(NEUTRAL, COLD, -t) : mix(NEUTRAL, WARM, t);
  const aged = mix(base, YELLOWED, clamp(age, 0, 1) * 0.5);
  const k = 0.86 + 0.24 * clamp(brightness, 0, 1);
  return toHex([aged[0] * k, aged[1] * k, aged[2] * k]);
}

/** Множитель для теней на сгибах: paper.shadow 0..1 → 0.55..1.45. */
export function shadeStrength(shadow: number): number {
  return 0.55 + 0.9 * clamp(shadow, 0, 1);
}

const DARK_INK: Rgb = parseHex('#1b130f');

/** Краска, которую читаешь на бумаге: если контраст ниже порога, затемняем её. */
export function readableInk(ink: string, paper: string, min = 4.5): string {
  const p = parseHex(paper);
  let c = parseHex(ink);
  for (let i = 0; i < 10 && contrast(c, p) < min; i++) c = mix(c, DARK_INK, 0.2);
  return toHex(c);
}
