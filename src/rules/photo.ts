/**
 * Правила фото: раскладка по числу, главный кадр и фрагмент вокруг точки,
 * внахлёст или в широком поле, краска подписей и две краски для duotone.
 */
import type { Layout, PhotoInput, PhotoSlot, Rect, WhyLine } from '../types/dayspec';
import type { Company } from './text';
import { clamp, quoteList, round } from './util';

const PAPER = '#f3efe6';
const FALLBACK_INK = '#2b5d67';
const MIN_CONTRAST = 4.5;

export interface PhotoRules {
  layout: Layout;
  photos: PhotoSlot[];
  ink: string;
  duo: [string, string];
  why: WhyLine[];
}

export function photoRules(
  list: PhotoInput[],
  company: Company,
  overrides?: { keyPhotoId?: string },
): PhotoRules {
  const why: WhyLine[] = [];
  const layout: Layout = list.length <= 1 ? 'window' : list.length === 2 ? 'diptych' : 'contact';
  why.push({
    param: 'layout',
    text:
      layout === 'window'
        ? 'Один снимок: он идёт одним окном'
        : layout === 'diptych'
          ? 'Два снимка: они идут диптихом'
          : `${list.length} ${list.length < 5 ? 'снимка' : 'снимков'}: они идут секвенцией, как на контактном листе`,
  });

  // главный кадр: выбор автора, иначе тот, где отмечена точка, иначе первый
  const chosen = list.find((p) => p.id === overrides?.keyPhotoId);
  const withFocus = list.find((p) => p.focus);
  const keyPhoto = chosen ?? withFocus ?? list[0];
  if (keyPhoto) {
    why.push({
      param: 'photos.role',
      text: chosen
        ? 'Главный кадр выбрал автор: в закрытой книжке виден его фрагмент, при раскрытии весь снимок'
        : withFocus
          ? 'Главный кадр тот, где отмечена точка: в закрытой книжке виден фрагмент вокруг неё, при раскрытии весь снимок'
          : 'Главный кадр первый: точек на снимках не отмечено, фрагмент берётся из середины',
    });
  }

  // внахлёст: «мы», имена, «вместе», «рядом»; «один» — отдельные кадры в широком поле
  const together = [...company.we, ...company.names, ...company.near];
  const alone = company.alone;
  const overlap =
    list.length > 1 && together.length > 0 && !(alone.length > 0 && !company.we.length);
  if (list.length > 1) {
    if (overlap) {
      why.push({
        param: 'photos.overlap',
        text: `Кадры внахлёст: в записи ${quoteList(together)}, близость видна по композиции`,
      });
    } else if (alone.length > 0) {
      why.push({
        param: 'photos.overlap',
        text: `Кадры раздельно, в широком поле: в записи ${quoteList(alone)}`,
      });
    }
  }

  const photos: PhotoSlot[] = list.map((p) => ({
    photoId: p.id,
    src: p.src,
    role: p === keyPhoto ? 'key' : 'support',
    crop: cropAround(p.focus?.x ?? 0.5, p.focus?.y ?? 0.5, p === keyPhoto ? 0.5 : 0.62),
    overlap,
  }));

  const palette = (keyPhoto?.palette ?? []).filter(isHex);
  const ink = pickInk(palette);
  if (palette.length) {
    why.push({
      param: 'ink',
      text: 'Краска подписей взята из главного кадра: самый выраженный цвет, затемнённый, чтобы читался на светлой бумаге',
    });
  }
  const duo = pickDuo(palette);

  return { layout, photos, ink, duo, why };
}

export function cropAround(x: number, y: number, size: number): Rect {
  const cx = clamp(Number.isFinite(x) ? x : 0.5, 0, 1);
  const cy = clamp(Number.isFinite(y) ? y : 0.5, 0, 1);
  return {
    x: round(clamp(cx - size / 2, 0, 1 - size)),
    y: round(clamp(cy - size / 2, 0, 1 - size)),
    w: size,
    h: size,
  };
}

// ---------- Цвет ----------

const HEX = /^#[0-9a-f]{6}$/i;

function isHex(c: string): boolean {
  return HEX.test(c);
}

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((v) =>
      Math.round(clamp(v, 0, 255))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Относительная яркость по WCAG. */
export function relLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function chroma(hex: string): number {
  const rgb = toRgb(hex);
  return (Math.max(...rgb) - Math.min(...rgb)) / 255;
}

function mix(hex: string, target: Rgb, t: number): string {
  const c = toRgb(hex);
  return toHex([0, 1, 2].map((i) => c[i] + (target[i] - c[i]) * t) as Rgb);
}

/** Самый выраженный цвет палитры, затемнённый до контраста не меньше 4,5:1 к светлой бумаге. */
export function pickInk(palette: string[]): string {
  if (!palette.length) return FALLBACK_INK;
  let best = palette[0];
  for (const c of palette) if (chroma(c) > chroma(best)) best = c;
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const c = mix(best, [0, 0, 0], t);
    if (contrast(c, PAPER) >= MIN_CONTRAST) return c;
  }
  return '#000000';
}

/** [тени, света] из палитры: самый тёмный и самый светлый цвет, разведённые до заметной разницы. */
export function pickDuo(palette: string[]): [string, string] {
  if (!palette.length) return ['#1b1d22', '#f3efe6'];
  const sorted = [...palette].sort((a, b) => relLuminance(a) - relLuminance(b));
  let shadow = sorted[0];
  let light = sorted[sorted.length - 1];
  for (let i = 0; i < 10 && contrast(shadow, light) < 3; i++) {
    shadow = mix(shadow, [0, 0, 0], 0.25);
    light = mix(light, [255, 255, 255], 0.25);
  }
  return [shadow, light];
}
