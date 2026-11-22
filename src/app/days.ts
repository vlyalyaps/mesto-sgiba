import { getDay, listDays, type StoredDay } from '../archive/db';
import { fixtures } from '../fixtures';
import { buildDaySpec, dayId } from '../rules';
import type { DayInput, DaySpec } from '../types/dayspec';

const base = import.meta.env.BASE_URL;

/** Скрытые дни нужны только сквозным тестам: они собирают приложение с VITE_ALL_DEMO. */
const showAll = !!import.meta.env.VITE_ALL_DEMO;

/** Демо-дни из fixtures; их фото лежат в public/, путь считаем от BASE_URL. */
export const demoDays: DayInput[] = fixtures
  .filter((f) => showAll || !f.hidden)
  .map((f) => ({
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
  // Свой день с тем же id главнее демо-дня.
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

/** Демо-дни без ожидания: экран сразу рисует обложки, и переход с полки идёт без скелетона. */
export function demoArchive(): ArchiveEntry[] {
  return demoDays
    .map((input) => ({
      id: dayId(input.date, input.number),
      spec: buildDaySpec(input),
      demo: true,
    }))
    .sort((a, b) => b.spec.date.localeCompare(a.spec.date) || b.spec.number - a.spec.number);
}

export function demoDay(id: string): DaySpec | null {
  const demo = demoDays.find((d) => dayId(d.date, d.number) === id);
  return demo ? buildDaySpec(demo) : null;
}

export async function loadDay(id: string): Promise<DaySpec | null> {
  const demo = demoDays.find((d) => dayId(d.date, d.number) === id);
  if (demo) return buildDaySpec(demo);
  const stored = await getDay(id);
  if (!stored) return null;
  try {
    return buildDaySpec(withPhotoUrls(stored));
  } catch (e) {
    console.warn('Повреждённый день в архиве пропущен:', id, e);
    return null;
  }
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
