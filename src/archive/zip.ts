/**
 * Папка дня в ZIP (fflate): «YYYY-MM-DD Название папки» / text.md, day.json, photos/, song.json,
 * dayspec.json, why.json. Звук песен в ZIP не кладём: только trackId, ссылки и признаки.
 * day.json — точное восстановление; остальное — для человека и прозрачности.
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { fixtures } from '../fixtures';
import { buildDaySpec, dayId } from '../rules';
import type {
  DayInput,
  DaySpec,
  Mood,
  Overrides,
  PhotoInput,
  SongFeatures,
  SongInput,
} from '../types/dayspec';
import { getDay, saveDay, type StoredDay } from './db';

const MOODS: Record<Mood, string> = {
  calm: 'спокойное',
  joyful: 'радостное',
  tired: 'усталое',
  restless: 'беспокойное',
  wistful: 'светлая грусть',
  curious: 'любопытное',
  proud: 'гордое',
};

/** Имя папки: дата и название, без символов, недопустимых в именах файлов. */
export function folderDirName(date: string, folderName: string): string {
  const clean = folderName
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '');
  return clean ? `${date} ${clean}` : date;
}

function textMd(input: DayInput, spec: DaySpec): string {
  const lines = [`# ${spec.folderName}`, '', `Дата: ${input.date}`];
  if (input.mood) lines.push(`Настроение: ${MOODS[input.mood]}`);
  if (input.weather) {
    const w = input.weather;
    lines.push(`Погода: ${w.place}, ${w.tempC > 0 ? '+' : ''}${w.tempC} °C`);
  }
  lines.push('', input.text.trim(), '');
  if (input.song) {
    const s = input.song;
    const year = s.year ? `, ${s.year}` : '';
    lines.push(
      `Песня дня: ${s.title || 'без названия'} — ${s.artist || 'неизвестный исполнитель'}${year}`,
    );
  } else {
    lines.push('Песня дня: нет');
  }
  return lines.join('\n') + '\n';
}

const json = (v: unknown) => strToU8(JSON.stringify(v, null, 2));

/** Чистая сборка файлов архива. photos — байты фото по PhotoInput.id. */
export function packDay(input: DayInput, photos: Record<string, Uint8Array>): Uint8Array {
  const spec = buildDaySpec(input);
  const dir = folderDirName(input.date, spec.folderName) + '/';
  const files: Zippable = {
    [dir + 'text.md']: strToU8(textMd(input, spec)),
    [dir + 'day.json']: json({
      ...input,
      photos: input.photos.map((p) => ({ ...p, src: undefined })),
    }),
    [dir + 'dayspec.json']: json(spec),
    [dir + 'why.json']: json(spec.why),
  };
  if (input.song) files[dir + 'song.json'] = json(input.song);
  for (const p of input.photos) {
    const bytes = photos[p.id];
    if (bytes) files[`${dir}photos/${p.id}.jpg`] = [bytes, { level: 0 }];
  }
  return zipSync(files);
}

export const MAX_ZIP_BYTES = 50 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const BAD = 'Этот ZIP не похож на папку дня';
const bad = (why: string) => new Error(`${BAD}: ${why}.`);

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const unit = (v: unknown): v is number => num(v) && v >= 0 && v <= 1;
const str = (v: unknown, max = 1000): v is string => typeof v === 'string' && v.length <= max;
const MOOD_KEYS = Object.keys(MOODS);

function https(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 2000) return null;
  try {
    const u = new URL(v);
    const host = u.hostname.toLowerCase();
    const ok = (d: string) => host === d || host.endsWith('.' + d);
    return u.protocol === 'https:' && (ok('apple.com') || ok('mzstatic.com')) ? v : null;
  } catch {
    return null;
  }
}
function strOrNull(v: unknown, field: string, max = 500): string | null {
  if (v == null) return null;
  if (!str(v, max)) throw bad(`поле ${field} должно быть строкой`);
  return v;
}
function intOrNull(v: unknown, field: string): number | null {
  if (v == null) return null;
  if (!num(v) || !Number.isInteger(v) || v < 0 || v > 3000) throw bad(`поле ${field} некорректно`);
  return v;
}

function parseSong(v: unknown): SongInput | null {
  if (v == null) return null;
  if (!isObj(v)) throw bad('песня описана неверно');
  const sources = ['itunes', 'link', 'own-file', 'taps'];
  if (typeof v.source !== 'string' || !sources.includes(v.source))
    throw bad('неизвестный источник песни');
  let features: SongFeatures | null = null;
  if (v.features != null) {
    const f = v.features;
    if (
      !isObj(f) ||
      !num(f.bpm) ||
      !num(f.energy) ||
      !num(f.energySpread) ||
      !num(f.peakSec) ||
      typeof f.measured !== 'boolean' ||
      (f.beats !== undefined &&
        !(Array.isArray(f.beats) && f.beats.length <= 1000 && f.beats.every(num)))
    )
      throw bad('признаки песни некорректны');
    features = {
      bpm: f.bpm,
      energy: f.energy,
      energySpread: f.energySpread,
      peakSec: f.peakSec,
      measured: f.measured,
      ...(f.beats ? { beats: f.beats as number[] } : {}),
    };
  }
  const trackId = v.trackId == null ? null : v.trackId;
  if (trackId !== null && !(num(trackId) && Number.isInteger(trackId)))
    throw bad('trackId некорректен');
  return {
    source: v.source as SongInput['source'],
    trackId,
    title: strOrNull(v.title, 'title') ?? '',
    artist: strOrNull(v.artist, 'artist') ?? '',
    trackViewUrl: https(v.trackViewUrl),
    previewUrl: https(v.previewUrl),
    artworkUrl: https(v.artworkUrl),
    year: intOrNull(v.year, 'year'),
    genre: strOrNull(v.genre, 'genre'),
    features,
  };
}

function parsePhoto(v: unknown): PhotoInput {
  if (!isObj(v)) throw bad('фото описано неверно');
  if (typeof v.id !== 'string' || !/^[\w-]{1,64}$/.test(v.id)) throw bad('недопустимый id фото');
  if (!num(v.width) || v.width <= 0 || !num(v.height) || v.height <= 0)
    throw bad('размеры фото некорректны');
  if (
    !Array.isArray(v.palette) ||
    v.palette.length > 8 ||
    !v.palette.every((c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c))
  )
    throw bad('палитра фото некорректна');
  if (!unit(v.lightness)) throw bad('светлота фото некорректна');
  const photo: PhotoInput = {
    id: v.id,
    src: '',
    width: v.width,
    height: v.height,
    palette: v.palette as string[],
    lightness: v.lightness,
  };
  if (v.caption != null) {
    if (!str(v.caption, 500)) throw bad('подпись фото некорректна');
    photo.caption = v.caption;
  }
  if (v.focus != null) {
    if (!isObj(v.focus) || !unit(v.focus.x) || !unit(v.focus.y))
      throw bad('точка фото некорректна');
    photo.focus = { x: v.focus.x, y: v.focus.y };
  }
  return photo;
}

/** Строгая проверка day.json из чужого ZIP: лишнее отбрасываем, неверное отклоняем. */
export function parseDayInput(raw: unknown): DayInput {
  if (!isObj(raw)) throw bad('day.json не объект');
  if (typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date))
    throw bad('дата должна быть вида ГГГГ-ММ-ДД');
  if (!num(raw.number) || !Number.isInteger(raw.number) || raw.number <= 0 || raw.number > 99999)
    throw bad('номер дня должен быть целым числом больше нуля');
  if (typeof raw.text !== 'string' || raw.text.length > 20000)
    throw bad('текст отсутствует или слишком длинный');
  if (!Array.isArray(raw.photos) || raw.photos.length < 1 || raw.photos.length > 5)
    throw bad('нужно от 1 до 5 фото');
  const photos = raw.photos.map(parsePhoto);
  if (new Set(photos.map((p) => p.id)).size !== photos.length) throw bad('id фото повторяются');

  const input: DayInput = {
    date: raw.date,
    number: raw.number,
    text: raw.text,
    photos,
    song: parseSong(raw.song),
  };
  if (raw.mood != null) {
    if (typeof raw.mood !== 'string' || !MOOD_KEYS.includes(raw.mood))
      throw bad('неизвестное настроение');
    input.mood = raw.mood as Mood;
  }
  if (raw.weather != null) {
    const w = raw.weather;
    if (!isObj(w) || !num(w.tempC) || !num(w.code) || !num(w.hour) || !str(w.place, 200))
      throw bad('погода описана неверно');
    input.weather = { tempC: w.tempC, code: w.code, hour: w.hour, place: w.place };
  }
  if (raw.takenAt != null) {
    if (!str(raw.takenAt, 40)) throw bad('время снимка некорректно');
    input.takenAt = raw.takenAt;
  }
  if (raw.overrides != null) {
    const o = raw.overrides;
    if (!isObj(o)) throw bad('правки описаны неверно');
    const out: Overrides = {};
    if (o.keySentence != null) {
      if (!num(o.keySentence) || !Number.isInteger(o.keySentence) || o.keySentence < 0)
        throw bad('главная фраза в правках некорректна');
      out.keySentence = o.keySentence;
    }
    if (o.keyPhotoId != null) {
      if (typeof o.keyPhotoId !== 'string') throw bad('главное фото в правках некорректно');
      out.keyPhotoId = o.keyPhotoId;
    }
    if (o.folderName != null) {
      if (!str(o.folderName, 200)) throw bad('название папки в правках некорректно');
      out.folderName = o.folderName;
    }
    input.overrides = out;
  }
  return input;
}

const ALLOWED = /^([^/\\]+\/)?(day\.json|photos\/[\w-]{1,64}\.jpg)$/;
const EXTRA = /^([^/\\]+\/)?(text\.md|dayspec\.json|why\.json|song\.json)$/;
export const MAX_FILES = 20;
export const MAX_TOTAL_BYTES = 60 * 1024 * 1024;
export const MAX_TEXT_BYTES = 1024 * 1024;

/** Чистый разбор: DayInput (src своих фото пустой) и байты фото. */
export function unpackDay(zip: Uint8Array): {
  input: DayInput;
  photos: Record<string, Uint8Array>;
} {
  if (zip.length > MAX_ZIP_BYTES) throw new Error(`${BAD}: файл больше 50 МБ.`);
  let files: Record<string, Uint8Array>;
  try {
    // Решаем по заголовкам до распаковки: читаем только day.json и фото, остальное пропускаем.
    let count = 0;
    let total = 0;
    files = unzipSync(zip, {
      filter: (f) => {
        if (++count > MAX_FILES) throw new Error('count');
        if (f.name.includes('..') || f.name.includes('\\')) throw new Error('path');
        if (f.originalSize > (f.name.endsWith('.jpg') ? MAX_PHOTO_BYTES : MAX_TEXT_BYTES))
          throw new Error('size');
        if (!ALLOWED.test(f.name)) {
          if (f.name.endsWith('/') || EXTRA.test(f.name)) return false;
          throw new Error('path');
        }
        total += f.originalSize;
        if (total > MAX_TOTAL_BYTES) throw new Error('total');
        return true;
      },
    });
  } catch {
    throw new Error(
      `${BAD}: файл повреждён, содержит лишние пути или слишком много и слишком большие файлы.`,
    );
  }
  const dayPath = Object.keys(files).find((n) => n === 'day.json' || n.endsWith('/day.json'));
  if (!dayPath) throw bad('в нём нет day.json');
  const root = dayPath.slice(0, dayPath.length - 'day.json'.length);

  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(files[dayPath]));
  } catch {
    throw bad('day.json повреждён');
  }
  const input = parseDayInput(raw);
  const photos: Record<string, Uint8Array> = {};
  for (const p of input.photos) {
    const bytes = files[`${root}photos/${p.id}.jpg`];
    if (!bytes) throw bad(`нет файла photos/${p.id}.jpg`);
    photos[p.id] = bytes;
  }
  return { input, photos };
}

export async function exportDay(id: string): Promise<Blob> {
  const day = await getDay(id);
  if (!day) throw new Error('Этого дня нет в архиве на этом устройстве.');
  const bytes: Record<string, Uint8Array> = {};
  for (const [pid, blob] of Object.entries(day.photos))
    bytes[pid] = new Uint8Array(await blob.arrayBuffer());
  return new Blob([packDay(day.input, bytes) as BlobPart], { type: 'application/zip' });
}

/** Восстанавливает день из ZIP в архив; возвращает id дня. */
export async function importZip(file: File): Promise<string> {
  if (file.size > MAX_ZIP_BYTES) throw new Error(`${BAD}: файл больше 50 МБ.`);
  const { input, photos } = unpackDay(new Uint8Array(await file.arrayBuffer()));
  const blobs: Record<string, Blob> = {};
  for (const [pid, b] of Object.entries(photos))
    blobs[pid] = new Blob([b as BlobPart], { type: 'image/jpeg' });
  // Не перезаписываем чужое: занятый id (свой или демо-дня) — берём следующий свободный номер.
  const demo = new Set(fixtures.map((f) => dayId(f.input.date, f.input.number)));
  let number = input.number;
  while (demo.has(dayId(input.date, number)) || (await getDay(dayId(input.date, number)))) number++;
  const id = dayId(input.date, number);
  const day: StoredDay = { id, input: { ...input, number }, photos: blobs, createdAt: Date.now() };
  await saveDay(day);
  return id;
}
