import type { SongInput } from '../types/dayspec';

const API = 'https://itunes.apple.com';
const MAX_RESULTS = 5;

/** Поля ответа iTunes Search API, которые мы читаем. */
export interface ItunesTrack {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  trackViewUrl?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  releaseDate?: string;
  primaryGenreName?: string;
}

// Слова-маркеры подделок: караоке, минусовки, каверы, трибьюты. Границы слов — по буквам Юникода,
// потому что \b не понимает кириллицу. «минус» ловим и как корень («минусовка»).
const L = '(?<![\\p{L}\\p{N}])';
const R = '(?![\\p{L}\\p{N}])';
const JUNK = new RegExp(
  `${L}(?:karaoke|instrumentals?|tributes?|originally performed|made famous|covers?|backing track|караоке|минус(?:овк\\p{L}*)?|инструментал|кавер(?:ы|-версия)?)${R}`,
  'iu',
);

export function isJunkTrack(t: ItunesTrack): boolean {
  return [t.trackName, t.collectionName, t.artistName].some((s) => !!s && JUNK.test(s));
}

/** Название для склейки дублей: без скобок, хвоста « - Remastered», знаков и регистра. */
export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[([{][^)\]}]*[)\]}]/g, ' ')
    .replace(/\s+[-–—]\s+.*$/, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function yearOf(releaseDate?: string): number | null {
  const y = Number(releaseDate?.slice(0, 4));
  return Number.isInteger(y) && y >= 1900 && y <= 2100 ? y : null;
}

/** Из ответа API: убрать подделки, склеить дубли (самый ранний год), оставить до limit. */
export function pickSongs(results: ItunesTrack[], limit = MAX_RESULTS): SongInput[] {
  const byKey = new Map<string, SongInput>();
  for (const t of results) {
    if (!t.trackId || !t.trackName || !t.artistName || isJunkTrack(t)) continue;
    const key = `${normalizeTitle(t.artistName)}|${normalizeTitle(t.trackName) || t.trackName}`;
    const year = yearOf(t.releaseDate);
    const prev = byKey.get(key);
    if (prev) {
      if (year !== null && (prev.year === null || year < prev.year)) prev.year = year;
      continue;
    }
    byKey.set(key, {
      source: 'itunes',
      trackId: t.trackId,
      title: t.trackName,
      artist: t.artistName,
      trackViewUrl: t.trackViewUrl ?? null,
      previewUrl: t.previewUrl ?? null,
      artworkUrl: t.artworkUrl100 ? t.artworkUrl100.replace('100x100bb', '600x600bb') : null,
      year,
      genre: t.primaryGenreName ?? null,
      features: null,
    });
  }
  return [...byKey.values()].slice(0, limit);
}

/**
 * Поиск песни в каталоге Apple (country=kz): до 5 вариантов, без караоке и минусовок.
 * CORS у API открыт, JSONP не нужен. Владелец — направление «ввод и звук».
 */
export async function searchSongs(term: string, signal?: AbortSignal): Promise<SongInput[]> {
  const q = term.trim();
  if (!q) return [];
  const url = `${API}/search?term=${encodeURIComponent(q)}&country=kz&media=music&entity=song&limit=25`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Каталог песен сейчас не отвечает. Попробуйте ещё раз.');
  const data = (await res.json()) as { results?: ItunesTrack[] };
  return pickSongs(data.results ?? []);
}

/**
 * trackId из ссылки Apple Music или iTunes: `?i=<id>` (песня внутри альбома)
 * или `/song/<название>/<id>`. null — не ссылка на песню.
 */
export function parseSongLink(link: string): number | null {
  const raw = link.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!/(^|\.)(music|itunes|geo\.itunes)\.apple\.com$/.test(host)) return null;
  const i = url.searchParams.get('i');
  if (i && /^\d+$/.test(i)) return Number(i);
  const m = /\/song\/(?:[^/]+\/)?(\d+)\/?$/.exec(url.pathname);
  return m ? Number(m[1]) : null;
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
