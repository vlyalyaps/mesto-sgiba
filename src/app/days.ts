import { listDays, type StoredDay } from '../archive/db';
import { fixtures } from '../fixtures';
import { buildDaySpec, dayId } from '../rules';
import type { DayInput, DaySpec } from '../types/dayspec';

const base = import.meta.env.BASE_URL;

/** Демо-дни из fixtures; их фото лежат в public/, путь считаем от BASE_URL. */
export const demoDays: DayInput[] = fixtures.map((f) => ({
  ...f.input,
  photos: f.input.photos.map((p) => ({ ...p, src: base + p.src })),
}));

export interface ArchiveEntry {
  id: string;
  spec: DaySpec;
  demo: boolean;
}

/** Все дни архива: свои и демо, новые сверху. DaySpec каждый раз считаем заново. */
export async function loadArchive(): Promise<ArchiveEntry[]> {
  const own: ArchiveEntry[] = [];
  for (const d of await listDays()) {
    try {
      own.push({ id: d.id, spec: buildDaySpec(withPhotoUrls(d)), demo: false });
    } catch (e) {
      console.warn('Повреждённый день в архиве пропущен:', d.id, e);
    }
  }
  // Демо-дни прибавляются и позже: совпавший по id свой день всегда главнее.
  const taken = new Set(own.map((entry) => entry.id));
  const demo = demoDays
    .filter((input) => !taken.has(dayId(input.date, input.number)))
    .map((input) => ({
      id: dayId(input.date, input.number),
      spec: buildDaySpec(input),
      demo: true,
    }));
  return [...own, ...demo].sort(
    (a, b) => b.spec.date.localeCompare(a.spec.date) || b.spec.number - a.spec.number,
  );
}

/** Демо-дни без ожидания: сетка сразу рисует их, пока читается архив. */
export function demoArchive(): ArchiveEntry[] {
  return demoDays
    .map((input) => ({
      id: dayId(input.date, input.number),
      spec: buildDaySpec(input),
      demo: true,
    }))
    .sort((a, b) => b.spec.date.localeCompare(a.spec.date) || b.spec.number - a.spec.number);
}

/** Номер для нового дня: следующий после самого большого в архиве. */
export async function nextDayNumber(): Promise<number> {
  const all = await loadArchive();
  return all.reduce((max, e) => Math.max(max, e.spec.number), 0) + 1;
}

const urls = new WeakMap<Blob, string>();

function withPhotoUrls(day: StoredDay): DayInput {
  return {
    ...day.input,
    photos: day.input.photos.map((p) => {
      const blob = day.photos[p.id];
      if (!blob) return p;
      let url = urls.get(blob);
      if (!url) {
        url = URL.createObjectURL(blob);
        urls.set(blob, url);
      }
      return { ...p, src: url };
    }),
  };
}
