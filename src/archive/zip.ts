/**
 * Папка дня в ZIP (fflate): «YYYY-MM-DD Название папки» / text.md, day.json, photos/, song.json,
 * dayspec.json, why.json. Звук песен в ZIP не кладём: только trackId, ссылки и признаки.
 * day.json — точное восстановление; остальное — для человека и прозрачности.
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { buildDaySpec, dayId } from '../rules';
import type { DayInput, DaySpec, Mood } from '../types/dayspec';
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

/** Чистый разбор: DayInput (src своих фото пустой) и байты фото. */
export function unpackDay(zip: Uint8Array): {
  input: DayInput;
  photos: Record<string, Uint8Array>;
} {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zip);
  } catch {
    throw new Error('Не удалось прочитать архив: это не ZIP или файл повреждён.');
  }
  const dayPath = Object.keys(files).find((n) => n === 'day.json' || n.endsWith('/day.json'));
  if (!dayPath) throw new Error('В архиве нет day.json: это не папка дня из «Места сгиба».');
  const root = dayPath.slice(0, dayPath.length - 'day.json'.length);

  let raw: DayInput;
  try {
    raw = JSON.parse(strFromU8(files[dayPath])) as DayInput;
  } catch {
    throw new Error('day.json в архиве повреждён.');
  }
  if (
    typeof raw?.date !== 'string' ||
    typeof raw.number !== 'number' ||
    typeof raw.text !== 'string' ||
    !Array.isArray(raw.photos)
  )
    throw new Error('day.json в архиве неполный: не хватает даты, номера, текста или фото.');

  const input: DayInput = {
    ...raw,
    song: raw.song ?? null,
    photos: raw.photos.map((p) => ({ ...p, src: '' })),
  };
  const photos: Record<string, Uint8Array> = {};
  for (const p of input.photos) {
    const bytes = files[`${root}photos/${p.id}.jpg`];
    if (bytes) photos[p.id] = bytes;
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
  const { input, photos } = unpackDay(new Uint8Array(await file.arrayBuffer()));
  const blobs: Record<string, Blob> = {};
  for (const [pid, b] of Object.entries(photos))
    blobs[pid] = new Blob([b as BlobPart], { type: 'image/jpeg' });
  const id = dayId(input.date, input.number);
  const day: StoredDay = { id, input, photos: blobs, createdAt: Date.now() };
  await saveDay(day);
  return id;
}
