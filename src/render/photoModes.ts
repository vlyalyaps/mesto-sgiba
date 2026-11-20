import type { PhotoMode } from '../types/dayspec';
import { luminance, parseHex, type Rgb } from './paper';

/**
 * Режимы фото из docs/rules.md через Canvas2D: warm / film / duotone / quiet.
 * Считаются один раз на (src, mode, duo, grain) и кэшируются как object URL.
 * Пиксельная часть (applyMode) чистая и проверяется Vitest без браузера.
 */

export const MAX_SIDE = 1200;

export interface LoadedImage {
  img: HTMLImageElement;
  width: number;
  height: number;
  /** SVG: рисуется в любом размере без потери резкости. */
  vector: boolean;
}

export interface ProcessedPhoto {
  url: string;
  width: number;
  height: number;
}

// ---------- Пиксели ----------

interface Look {
  sepia: number;
  saturate: number;
  contrast: number;
  brightness: number;
  /** Подъём чёрного (выцветание), 0..255. */
  lift: number;
}

const LOOKS: Record<Exclude<PhotoMode, 'duotone'>, Look> = {
  warm: { sepia: 0.2, saturate: 1.15, contrast: 0.97, brightness: 1.03, lift: 0 },
  film: { sepia: 0.5, saturate: 0.72, contrast: 0.86, brightness: 1.06, lift: 16 },
  quiet: { sepia: 0, saturate: 0.55, contrast: 0.82, brightness: 1.12, lift: 0 },
};

/** Сила зерна на самом снимке в уровнях 0..255 по режиму и paper.grain. */
export function grainAmplitude(mode: PhotoMode, grain: number): number {
  const g = Math.min(1, Math.max(0, grain));
  if (mode === 'film') return 8 + g * 34;
  if (mode === 'duotone') return g * 22;
  if (mode === 'warm') return g * 12;
  return g * 6;
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}

/** Меняет пиксели RGBA на месте. Одинаковый вход всегда даёт одинаковый результат. */
export function applyMode(
  px: Uint8ClampedArray,
  mode: PhotoMode,
  duo: [string, string],
  grain: number,
  seed = 1,
): void {
  const amp = grainAmplitude(mode, grain);
  let s = seed >>> 0 || 1;
  const noise = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296 - 0.5;
  };

  if (mode === 'duotone') {
    let dark: Rgb = parseHex(duo[0]);
    let light: Rgb = parseHex(duo[1]);
    if (luminance(dark) > luminance(light)) [dark, light] = [light, dark];
    for (let i = 0; i < px.length; i += 4) {
      const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      let t = ((l - 128) * 1.4 + 128) * 1.1 + noise() * amp;
      t = Math.min(1, Math.max(0, t / 255));
      t = t * t * (3 - 2 * t) * 0.6 + t * 0.4;
      px[i] = dark[0] + (light[0] - dark[0]) * t;
      px[i + 1] = dark[1] + (light[1] - dark[1]) * t;
      px[i + 2] = dark[2] + (light[2] - dark[2]) * t;
    }
    return;
  }

  const k = LOOKS[mode];
  const a = 1 - k.sepia;
  const m = [
    0.393 + 0.607 * a,
    0.769 - 0.769 * a,
    0.189 - 0.189 * a,
    0.349 - 0.349 * a,
    0.686 + 0.314 * a,
    0.168 - 0.168 * a,
    0.272 - 0.272 * a,
    0.534 - 0.534 * a,
    0.131 + 0.869 * a,
  ];
  const fade = k.lift / 255;
  for (let i = 0; i < px.length; i += 4) {
    const r0 = px[i];
    const g0 = px[i + 1];
    const b0 = px[i + 2];
    let r = m[0] * r0 + m[1] * g0 + m[2] * b0;
    let g = m[3] * r0 + m[4] * g0 + m[5] * b0;
    let b = m[6] * r0 + m[7] * g0 + m[8] * b0;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = l + (r - l) * k.saturate;
    g = l + (g - l) * k.saturate;
    b = l + (b - l) * k.saturate;
    r = ((r - 128) * k.contrast + 128) * k.brightness;
    g = ((g - 128) * k.contrast + 128) * k.brightness;
    b = ((b - 128) * k.contrast + 128) * k.brightness;
    if (fade) {
      r = r * (1 - fade) + k.lift;
      g = g * (1 - fade) + k.lift;
      b = b * (1 - fade) + k.lift * 0.9;
    }
    if (amp) {
      const n = noise() * amp;
      r += n;
      g += n;
      b += n;
    }
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
}

// ---------- Загрузка и кэш ----------

export function modeKey(
  src: string,
  mode: PhotoMode,
  duo: [string, string],
  grain: number,
): string {
  return [src, mode, mode === 'duotone' ? duo.join('') : '', grain.toFixed(2)].join('|');
}

const loaded = new Map<string, Promise<LoadedImage>>();
const done = new Map<string, ProcessedPhoto>();
const processing = new Map<string, Promise<ProcessedPhoto>>();

/** Картинка и её размеры. У SVG без width/height размеры берём из viewBox. */
export function loadImage(src: string): Promise<LoadedImage> {
  let p = loaded.get(src);
  if (!p) {
    p = new Promise<LoadedImage>((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = async () => {
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        const vector = /\.svg(\?|$)/i.test(src);
        if (vector) {
          // Размер растра у SVG браузер выбирает сам (часто 300 px): берём пропорции из viewBox.
          try {
            const text = await (await fetch(src)).text();
            const vb = /viewBox=['"]\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(text);
            if (vb) {
              width = Number(vb[1]);
              height = Number(vb[2]);
            }
          } catch {
            /* оставим размеры по умолчанию */
          }
        }
        resolve({ img, width: width || 4, height: height || 5, vector });
      };
      img.onerror = () => reject(new Error('Не удалось загрузить фото'));
      img.src = src;
    });
    p.catch(() => loaded.delete(src));
    loaded.set(src, p);
  }
  return p;
}

/** Уже посчитанное фото, если есть: чтобы не мигать при повторном показе. */
export function readyPhoto(
  src: string,
  mode: PhotoMode,
  duo: [string, string],
  grain: number,
): ProcessedPhoto | undefined {
  return done.get(modeKey(src, mode, duo, grain));
}

// Тяжёлые расчёты идут по очереди, между ними браузер успевает отрисовать кадр.
let queue: Promise<unknown> = Promise.resolve();

export function processPhoto(
  src: string,
  mode: PhotoMode,
  duo: [string, string],
  grain: number,
): Promise<ProcessedPhoto> {
  const key = modeKey(src, mode, duo, grain);
  const hit = done.get(key);
  if (hit) return Promise.resolve(hit);
  let p = processing.get(key);
  if (!p) {
    const job = queue.then(async () => {
      await new Promise((r) => setTimeout(r, 0));
      const { img, width, height, vector } = await loadImage(src);
      // Растр не увеличиваем, SVG рисуем сразу в нужный размер.
      const k = vector
        ? MAX_SIDE / Math.max(width, height)
        : Math.min(1, MAX_SIDE / Math.max(width, height));
      const w = Math.max(1, Math.round(width * k));
      const h = Math.max(1, Math.round(height * k));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Нет Canvas2D');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      applyMode(data.data, mode, duo, grain, hashSeed(key));
      ctx.putImageData(data, 0, 0);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.88));
      if (!blob) throw new Error('Не удалось сохранить фото');
      const out: ProcessedPhoto = { url: URL.createObjectURL(blob), width, height };
      done.set(key, out);
      return out;
    });
    queue = job.catch(() => undefined);
    p = job;
    processing.set(key, p);
    p.catch(() => processing.delete(key));
  }
  return p;
}
