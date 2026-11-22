/**
 * Картинки листа по id. Купленные стикеры и текстуры лежат в src/assets/local (см. CREDITS.md).
 * Редактор работает и без этой папки: тогда их просто нет в наборе.
 */
import type { DaySpec } from '../types/dayspec';

export interface LocalSticker {
  id: string;
  title: string;
  season: 'autumn' | 'winter' | 'spring' | 'summer';
  w: number;
  h: number;
}

export interface LocalPaper {
  id: string;
  title: string;
  dark: boolean;
  color: string;
}

const files = import.meta.glob<string>('../assets/local/*/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});
const manifests = import.meta.glob<{ stickers: LocalSticker[]; papers: LocalPaper[] }>(
  '../assets/local/manifest.json',
  { eager: true, import: 'default' },
);
const manifest = Object.values(manifests)[0];

export const localStickers: LocalSticker[] = manifest?.stickers ?? [];
export const localPapers: LocalPaper[] = manifest?.papers ?? [];

export function assetUrl(id: string): string | null {
  if (id.startsWith('seasons/') || id.startsWith('papers/'))
    return files[`../assets/local/${id}.webp`] ?? null;
  return `${import.meta.env.BASE_URL}${id}.webp`;
}

/** Маленькая копия для списка фактур. */
export function thumbUrl(id: string): string | null {
  return id.startsWith('papers/') ? assetUrl(`${id}.thumb`) : assetUrl(id);
}

/** Фактура: файл набора или снимок этого дня. */
export function textureUrl(id: string | undefined, photos: DaySpec['photos']): string | null {
  if (!id || id === 'none') return null;
  if (id.startsWith('photo:')) return photos.find((p) => p.photoId === id.slice(6))?.src || null;
  return assetUrl(id);
}

/** У стикеров Freepik подпись обязательна. */
export function usesFreepik(spec: DaySpec): boolean {
  return spec.page.elements.some((e) => e.kind === 'image' && e.asset.startsWith('seasons/'));
}
