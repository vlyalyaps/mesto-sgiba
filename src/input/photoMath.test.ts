import { describe, expect, it } from 'vitest';
import {
  extractPalette,
  fitSize,
  oklabToRgb,
  readExifTakenAt,
  rgbToHex,
  rgbToOklab,
} from './photoMath';

describe('fitSize', () => {
  it('уменьшает по длинной стороне до 1600', () => {
    expect(fitSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });
  it('не увеличивает маленькие', () => {
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitSize(1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });
  it('не даёт нулевую сторону у очень вытянутых', () => {
    expect(fitSize(16000, 3).height).toBe(1);
  });
});

describe('OKLab', () => {
  it('белый — L=1, чёрный — L=0, без цветности', () => {
    const w = rgbToOklab(255, 255, 255);
    expect(w[0]).toBeCloseTo(1, 3);
    expect(Math.abs(w[1])).toBeLessThan(1e-3);
    expect(rgbToOklab(0, 0, 0)[0]).toBeCloseTo(0, 5);
  });
  it('красный совпадает с эталоном OKLab', () => {
    const [L, a, b] = rgbToOklab(255, 0, 0);
    expect(L).toBeCloseTo(0.628, 2);
    expect(a).toBeCloseTo(0.2249, 2);
    expect(b).toBeCloseTo(0.1258, 2);
  });
  it('обратное преобразование возвращает исходный цвет', () => {
    for (const rgb of [
      [12, 200, 77],
      [250, 128, 5],
      [90, 90, 200],
    ] as const) {
      expect(oklabToRgb(...rgbToOklab(rgb[0], rgb[1], rgb[2]))).toEqual([...rgb]);
    }
  });
  it('rgbToHex', () => {
    expect(rgbToHex(255, 0, 10)).toBe('#ff000a');
  });
});

function fill(parts: [number, number, number, number][]): number[] {
  const out: number[] = [];
  for (const [r, g, b, n] of parts) for (let i = 0; i < n; i++) out.push(r, g, b, 255);
  return out;
}

describe('extractPalette', () => {
  it('находит три цвета и сортирует по доле', () => {
    const { palette } = extractPalette(
      fill([
        [0, 0, 255, 100],
        [255, 0, 0, 500],
        [0, 200, 0, 300],
      ]),
    );
    expect(palette).toEqual(['#ff0000', '#00c800', '#0000ff']);
  });
  it('даёт 3–5 цветов даже для плоской заливки', () => {
    const { palette, lightness } = extractPalette(fill([[200, 150, 100, 400]]));
    expect(palette.length).toBeGreaterThanOrEqual(3);
    expect(palette.length).toBeLessThanOrEqual(5);
    expect(palette[0]).toBe('#c89664');
    expect(lightness).toBeGreaterThan(0.6);
    expect(lightness).toBeLessThan(0.8);
  });
  it('не больше 5 цветов на пёстрой картинке и детерминирован', () => {
    const px: [number, number, number, number][] = [];
    for (let i = 0; i < 40; i++) px.push([(i * 37) % 256, (i * 91) % 256, (i * 53) % 256, 10]);
    const a = extractPalette(fill(px));
    expect(a.palette.length).toBeLessThanOrEqual(5);
    expect(extractPalette(fill(px))).toEqual(a);
  });
  it('светлота: чёрный ~0, белый ~1', () => {
    expect(extractPalette(fill([[0, 0, 0, 50]])).lightness).toBeCloseTo(0, 2);
    expect(extractPalette(fill([[255, 255, 255, 50]])).lightness).toBeCloseTo(1, 2);
  });
  it('игнорирует прозрачные пиксели и пустой ввод', () => {
    const data = [255, 0, 0, 0, 0, 0, 255, 255];
    expect(extractPalette(data).palette[0]).toBe('#0000ff');
    expect(extractPalette([]).palette.length).toBe(3);
  });
});

/** Собирает минимальный JPEG: SOI + APP0 + APP1(Exif) с DateTimeOriginal. */
function jpegWithExif(date: string | null, littleEndian: boolean): ArrayBuffer {
  const le = littleEndian;
  const tiff = new DataView(new ArrayBuffer(200));
  let p = 0;
  const u16 = (v: number) => {
    tiff.setUint16(p, v, le);
    p += 2;
  };
  const u32 = (v: number) => {
    tiff.setUint32(p, v, le);
    p += 4;
  };
  tiff.setUint16(0, le ? 0x4949 : 0x4d4d);
  p = 2;
  u16(42);
  u32(8);
  // IFD0 с одной записью: ExifIFD pointer → смещение 26
  u16(1);
  u16(0x8769);
  u16(4);
  u32(1);
  u32(26);
  u32(0);
  // ExifIFD с одной записью: DateTimeOriginal → строка по смещению 44
  p = 26;
  u16(1);
  u16(0x9003);
  u16(2);
  u32(20);
  u32(44);
  u32(0);
  const text = date ?? '';
  for (let i = 0; i < text.length; i++) tiff.setUint8(44 + i, text.charCodeAt(i));
  const tiffBytes = new Uint8Array(tiff.buffer, 0, 64);

  const exifBody = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiffBytes];
  const app1Len = exifBody.length + 2;
  const bytes = [
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x04,
    0x4a,
    0x46, // «APP0» с 2 байтами данных
    0xff,
    0xe1,
    app1Len >> 8,
    app1Len & 0xff,
    ...exifBody,
    0xff,
    0xda,
    0x00,
    0x02,
  ];
  return new Uint8Array(bytes).buffer;
}

describe('readExifTakenAt', () => {
  it('читает DateTimeOriginal в обоих порядках байт', () => {
    for (const le of [true, false]) {
      expect(readExifTakenAt(jpegWithExif('2026:11:21 18:42:07\0', le))).toBe(
        '2026-11-21T18:42:07',
      );
    }
  });
  it('пустая или нулевая дата — undefined', () => {
    expect(readExifTakenAt(jpegWithExif('0000:00:00 00:00:00\0', true))).toBeUndefined();
    expect(readExifTakenAt(jpegWithExif('                   \0', true))).toBeUndefined();
  });
  it('не JPEG, пустой и обрезанный буфер — undefined, без исключений', () => {
    expect(readExifTakenAt(new ArrayBuffer(0))).toBeUndefined();
    expect(readExifTakenAt(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBeUndefined();
    expect(
      readExifTakenAt(jpegWithExif('2026:11:21 18:42:07\0', true).slice(0, 40)),
    ).toBeUndefined();
  });
});
