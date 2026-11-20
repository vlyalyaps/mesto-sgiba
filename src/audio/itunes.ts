import type { SongInput } from '../types/dayspec';

const API = 'https://itunes.apple.com';

/**
 * Поиск песни в каталоге Apple (country=kz): до 5 вариантов, без караоке и минусовок.
 * CORS у API открыт, JSONP не нужен. Владелец — направление «ввод и звук».
 */
export async function searchSongs(term: string, signal?: AbortSignal): Promise<SongInput[]> {
  void term;
  void signal;
  return [];
}

/**
 * Свежая ссылка на 30-секундный фрагмент по trackId: старые ссылки со временем умирают,
 * поэтому храним только trackId. null — трека больше нет в каталоге или нет сети.
 */
export async function refreshPreview(
  trackId: number,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch(`${API}/lookup?id=${trackId}&country=kz`, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: { previewUrl?: string }[] };
    return data.results?.[0]?.previewUrl ?? null;
  } catch (err) {
    if (signal?.aborted) throw err;
    return null;
  }
}
