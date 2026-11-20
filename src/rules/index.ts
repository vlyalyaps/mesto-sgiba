import type { DayInput, DaySpec, Fold, Layout, PhotoMode, PhotoSlot, Rect } from '../types/dayspec';

/** 'YYYY-MM-DD-NNN': один id для DaySpec, архива и ссылки #/day/…. */
export function dayId(date: string, number: number): string {
  return `${date}-${String(number).padStart(3, '0')}`;
}

/**
 * Временные правила, чтобы приложение и отрисовка работали с первого дня.
 * Настоящие правила из docs/rules.md заменят внутренности, сохранив сигнатуру.
 */
export function buildDaySpec(input: DayInput): DaySpec {
  const sentences = splitSentences(input.text);
  const turn = sentences.findIndex((s, i) => i > 0 && TRANSITION.test(s));
  const keyIndex = input.overrides?.keySentence ?? (turn >= 0 ? turn : sentences.length - 1);
  const keyText = sentences[keyIndex] ?? input.text.trim();

  const folds: Fold[] = sentences
    .map((text, sentence) => ({ text, sentence }))
    .filter((s) => s.sentence !== keyIndex)
    .map((s) => ({
      ...s,
      width: clamp(s.text.length / 140, 0.08, 0.22),
      side: s.sentence < keyIndex ? 'before' : 'after',
    }));

  const together = /(^|[^а-яё])(мы|вместе|нас)([^а-яё]|$)/i.test(input.text);
  const keyPhotoId = input.overrides?.keyPhotoId ?? input.photos[0]?.id;
  const photos: PhotoSlot[] = input.photos.map((p) => ({
    photoId: p.id,
    src: p.src,
    role: p.id === keyPhotoId ? 'key' : 'support',
    crop: cropAround(p.focus?.x ?? 0.5, p.focus?.y ?? 0.5),
    overlap: together,
  }));
  const layout: Layout =
    input.photos.length <= 1 ? 'window' : input.photos.length === 2 ? 'diptych' : 'contact';

  const f = input.song?.features;
  const energy = f?.energy ?? 0.4;
  const bpm = f?.bpm ?? 90;
  const year = input.song?.year ?? null;
  const mode: PhotoMode =
    energy < 0.35
      ? 'quiet'
      : year !== null && year < 2000
        ? 'film'
        : energy > 0.7
          ? 'duotone'
          : 'warm';

  const keyPhoto = input.photos.find((p) => p.id === keyPhotoId) ?? input.photos[0];
  const palette = keyPhoto?.palette ?? ['#2b5d67'];
  const byLight = [...palette].sort((a, b) => luminance(a) - luminance(b));
  const beatsPerFold = bpm >= 110 ? 4 : 8;

  return {
    v: 1,
    id: dayId(input.date, input.number),
    date: input.date,
    number: input.number,
    folderName: input.overrides?.folderName ?? folderName(keyText),
    key: {
      text: keyText,
      sentence: keyIndex,
      by: input.overrides?.keySentence !== undefined ? 'author' : turn >= 0 ? 'transition' : 'last',
    },
    folds,
    photos,
    layout,
    mode,
    paper: {
      tone: 0,
      spreadTone: 0.2,
      brightness: 0.6,
      shadow: 0.5,
      margin: 0.4,
      age: year !== null && year < 2000 ? 0.6 : 0.1,
      grain: energy,
    },
    ink: palette[0],
    duo: [byLight[0], byLight[byLight.length - 1]],
    rhythm: { beatsPerFold, density: energy },
    reveal: {
      durationMs: Math.round((60000 / bpm) * beatsPerFold),
      peakSec: f ? f.peakSec : null,
      prerollSec: 4,
      beats: f?.beats ?? [],
    },
    song: input.song
      ? {
          trackId: input.song.trackId,
          title: input.song.title,
          artist: input.song.artist,
          trackViewUrl: input.song.trackViewUrl,
          previewUrl: input.song.previewUrl,
          artworkUrl: input.song.artworkUrl,
          year: input.song.year,
        }
      : null,
    why: [
      { param: 'rules', text: 'Пока работают временные правила: настоящие появятся в src/rules.' },
    ],
  };
}

const TRANSITION = /^(а потом|вдруг|но|и тут|наконец)/i;

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function folderName(key: string): string {
  const words = key
    .replace(TRANSITION, '')
    .replace(/[—–.,!?…:;«»"]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 7);
  const name = words.join(' ');
  return name ? name[0].toUpperCase() + name.slice(1) : 'День без слов';
}

function cropAround(x: number, y: number): Rect {
  const w = 0.5;
  const h = 0.5;
  return { x: clamp(x - w / 2, 0, 1 - w), y: clamp(y - h / 2, 0, 1 - h), w, h };
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
