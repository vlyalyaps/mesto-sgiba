/** Чистая часть подготовки фото: размеры, OKLab, палитра k-means, EXIF. Без canvas и DOM. */

export type Lab = [number, number, number];

/** Размер после уменьшения по длинной стороне до max; увеличивать не нужно. */
export function fitSize(
  width: number,
  height: number,
  max = 1600,
): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= max) return { width, height };
  const k = max / long;
  return {
    width: Math.max(1, Math.round(width * k)),
    height: Math.max(1, Math.round(height * k)),
  };
}

// ---------- OKLab ----------

function toLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function fromLinear(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(c * 255)));
}

/** sRGB 0..255 → OKLab (L 0..1). */
export function rgbToOklab(r: number, g: number, b: number): Lab {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab → sRGB 0..255 (с обрезкой по гамме). */
export function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function dist2(p: Lab, q: Lab): number {
  const dl = p[0] - q[0];
  const da = p[1] - q[1];
  const db = p[2] - q[2];
  return dl * dl + da * da + db * db;
}

// ---------- Палитра ----------

export interface PaletteResult {
  palette: string[];
  /** Средняя светлота OKLab 0..1. */
  lightness: number;
}

/**
 * Палитра по RGBA-пикселям (как у ImageData): 3–5 цветов '#rrggbb' по убыванию доли.
 * Детерминированно: начальные центры — самые далёкие друг от друга точки.
 */
export function extractPalette(rgba: ArrayLike<number>, maxColors = 5): PaletteResult {
  const pts: Lab[] = [];
  let lightSum = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    const lab = rgbToOklab(rgba[i], rgba[i + 1], rgba[i + 2]);
    pts.push(lab);
    lightSum += lab[0];
  }
  if (pts.length === 0) return { palette: ['#808080', '#999999', '#666666'], lightness: 0.6 };
  const lightness = Math.min(1, Math.max(0, lightSum / pts.length));

  const k = Math.min(maxColors, pts.length);
  // Старт: точка, ближайшая к среднему, затем каждый раз самая далёкая от выбранных.
  const mean: Lab = [0, 0, 0];
  for (const p of pts) {
    mean[0] += p[0] / pts.length;
    mean[1] += p[1] / pts.length;
    mean[2] += p[2] / pts.length;
  }
  let first = 0;
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = dist2(pts[i], mean);
    if (d < best) {
      best = d;
      first = i;
    }
  }
  const centers: Lab[] = [[...pts[first]] as Lab];
  const minD = pts.map((p) => dist2(p, centers[0]));
  while (centers.length < k) {
    let far = 0;
    for (let i = 1; i < pts.length; i++) if (minD[i] > minD[far]) far = i;
    if (minD[far] === 0) break;
    const c = [...pts[far]] as Lab;
    centers.push(c);
    for (let i = 0; i < pts.length; i++) minD[i] = Math.min(minD[i], dist2(pts[i], c));
  }

  const counts = new Array<number>(centers.length).fill(0);
  const assign = new Array<number>(pts.length).fill(-1);
  for (let iter = 0; iter < 20; iter++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      let bi = 0;
      let bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = dist2(pts[i], centers[c]);
        if (d < bd) {
          bd = d;
          bi = c;
        }
      }
      if (assign[i] !== bi) moved = true;
      assign[i] = bi;
    }
    const sums = centers.map(() => [0, 0, 0]);
    counts.fill(0);
    for (let i = 0; i < pts.length; i++) {
      const s = sums[assign[i]];
      s[0] += pts[i][0];
      s[1] += pts[i][1];
      s[2] += pts[i][2];
      counts[assign[i]]++;
    }
    for (let c = 0; c < centers.length; c++) {
      if (counts[c] > 0) {
        centers[c] = [sums[c][0] / counts[c], sums[c][1] / counts[c], sums[c][2] / counts[c]];
      }
    }
    if (!moved) break;
  }

  // Слить почти одинаковые центры (ΔOKLab < 0.04), доли сложить.
  const sorted = centers
    .map((c, i) => ({ lab: c, n: counts[i] }))
    .filter((g) => g.n > 0)
    .sort((a, b) => b.n - a.n);
  const merged: { lab: Lab; n: number }[] = [];
  for (const g of sorted) {
    const near = merged.find((m) => dist2(m.lab, g.lab) < 0.04 * 0.04);
    if (near) near.n += g.n;
    else merged.push({ ...g });
  }
  merged.sort((a, b) => b.n - a.n);

  const palette = merged.map((g) => rgbToHex(...oklabToRgb(g.lab[0], g.lab[1], g.lab[2])));
  // Плоский снимок: дополняем оттенками главного цвета, чтобы набор был 3–5.
  const base = merged[0].lab;
  const shifts = [0.12, -0.12, 0.22, -0.22];
  for (let i = 0; palette.length < 3 && i < shifts.length; i++) {
    const L = Math.min(0.98, Math.max(0.02, base[0] + shifts[i]));
    const hex = rgbToHex(...oklabToRgb(L, base[1], base[2]));
    if (!palette.includes(hex)) palette.push(hex);
  }
  return { palette: palette.slice(0, maxColors), lightness };
}

// ---------- EXIF ----------

/**
 * Время съёмки из EXIF DateTimeOriginal (0x9003) JPEG: ISO без пояса, 'YYYY-MM-DDTHH:MM:SS'.
 * undefined, если это не JPEG, EXIF нет или дата пустая/битая.
 */
export function readExifTakenAt(buf: ArrayBuffer): string | undefined {
  try {
    const v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return undefined;
    let pos = 2;
    while (pos + 4 <= v.byteLength) {
      if (v.getUint8(pos) !== 0xff) return undefined;
      const marker = v.getUint8(pos + 1);
      if (marker === 0xff) {
        pos++;
        continue;
      }
      if (marker === 0xda || marker === 0xd9) return undefined;
      const len = v.getUint16(pos + 2);
      if (marker === 0xe1 && len >= 8) {
        const start = pos + 4;
        // "Exif\0\0"
        const isExif = v.getUint32(start) === 0x45786966 && v.getUint16(start + 4) === 0;
        if (isExif) {
          const r = readTiff(v, start + 6, Math.min(v.byteLength, pos + 2 + len));
          if (r) return r;
        }
      }
      pos += 2 + len;
    }
  } catch {
    // обрезанный или битый файл — просто без даты
  }
  return undefined;
}

function readTiff(v: DataView, tiff: number, end: number): string | undefined {
  const bom = v.getUint16(tiff);
  const le = bom === 0x4949;
  if (!le && bom !== 0x4d4d) return undefined;
  if (v.getUint16(tiff + 2, le) !== 42) return undefined;
  const ifd0 = tiff + v.getUint32(tiff + 4, le);

  const findTag = (ifd: number, tag: number): number | undefined => {
    if (ifd < tiff || ifd + 2 > end) return undefined;
    const n = v.getUint16(ifd, le);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (e + 12 > end) return undefined;
      if (v.getUint16(e, le) === tag) return e;
    }
    return undefined;
  };

  const ptr = findTag(ifd0, 0x8769);
  if (ptr === undefined) return undefined;
  const exifIfd = tiff + v.getUint32(ptr + 8, le);
  const e = findTag(exifIfd, 0x9003);
  if (e === undefined) return undefined;
  if (v.getUint16(e + 2, le) !== 2) return undefined; // ASCII
  const count = v.getUint32(e + 4, le);
  if (count < 19) return undefined;
  const off = count <= 4 ? e + 8 : tiff + v.getUint32(e + 8, le);
  if (off + 19 > end) return undefined;
  let s = '';
  for (let i = 0; i < 19; i++) s += String.fromCharCode(v.getUint8(off + i));
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (!m) return undefined;
  const [, y, mo, d, h, mi, se] = m;
  if (y === '0000' || mo === '00' || d === '00') return undefined;
  if (+mo > 12 || +d > 31 || +h > 23 || +mi > 59 || +se > 59) return undefined;
  return `${y}-${mo}-${d}T${h}:${mi}:${se}`;
}
