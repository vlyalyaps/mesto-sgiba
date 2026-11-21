import { extractPalette, fitSize, readExifTakenAt } from './photoMath';

/** Фото, готовое для DayInput: уменьшенное до 1600 px по длинной стороне. */
export interface PreparedPhoto {
  blob: Blob;
  width: number;
  height: number;
  /** 3–5 цветов по убыванию доли, '#rrggbb' (k-means в OKLab на уменьшенной копии). */
  palette: string[];
  /** Средняя светлота 0..1. */
  lightness: number;
  /** Время съёмки из EXIF DateTimeOriginal, ISO без пояса. Только для JPEG с EXIF. */
  takenAt?: string;
}

const MAX_SIDE = 1600;
const PALETTE_SIDE = 64;
const JPEG_QUALITY = 0.86;
export const UNREADABLE_PHOTO =
  'Это фото браузер не открывает. Сохраните его как JPEG и попробуйте снова.';

type Canvas2D = OffscreenCanvas | HTMLCanvasElement;
type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function makeCanvas(w: number, h: number): { canvas: Canvas2D; ctx: Ctx2D } {
  const canvas: Canvas2D =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d') as Ctx2D | null;
  if (!ctx) throw new Error(UNREADABLE_PHOTO);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

function toJpeg(canvas: Canvas2D): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error(UNREADABLE_PHOTO))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

/** Готовит снимок из <input type="file">. Владелец — направление «ввод и звук». */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(UNREADABLE_PHOTO);
  }
  try {
    const { width, height } = fitSize(bitmap.width, bitmap.height, MAX_SIDE);

    const big = makeCanvas(width, height);
    // Прозрачные PNG кладём на белое: в JPEG прозрачности нет.
    big.ctx.fillStyle = '#ffffff';
    big.ctx.fillRect(0, 0, width, height);
    big.ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await toJpeg(big.canvas);

    const small = fitSize(width, height, PALETTE_SIDE);
    const tiny = makeCanvas(small.width, small.height);
    tiny.ctx.fillStyle = '#ffffff';
    tiny.ctx.fillRect(0, 0, small.width, small.height);
    tiny.ctx.drawImage(big.canvas as CanvasImageSource, 0, 0, small.width, small.height);
    const { palette, lightness } = extractPalette(
      tiny.ctx.getImageData(0, 0, small.width, small.height).data,
    );

    let takenAt: string | undefined;
    try {
      takenAt = readExifTakenAt(await file.slice(0, 256 * 1024).arrayBuffer());
    } catch {
      takenAt = undefined;
    }

    return { blob, width, height, palette, lightness, ...(takenAt ? { takenAt } : {}) };
  } finally {
    bitmap.close();
  }
}
