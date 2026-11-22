import type { DaySpec } from '../types/dayspec';

export interface DayCell {
  /** 'YYYY-MM-DD'. */
  date: string;
  day: number;
  /** Записи этого дня по порядку; пустой массив — день без записи. */
  specs: DaySpec[];
}

export interface MonthBlock {
  /** 'YYYY-MM'. */
  month: string;
  cells: DayCell[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Все дни подряд, как в галерее: от первого числа самого раннего месяца с записью
 * до сегодня (или до последней записи, если она позже), сгруппированные по месяцам.
 */
export function buildCalendar(specs: DaySpec[], today: string): MonthBlock[] {
  const byDate = new Map<string, DaySpec[]>();
  for (const s of [...specs].sort((a, b) => a.number - b.number))
    byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  const dates = [...byDate.keys(), today].sort();
  const [y, m] = dates[0].split('-').map(Number);
  const end = dates[dates.length - 1];
  const blocks: MonthBlock[] = [];
  for (let d = new Date(Date.UTC(y, m - 1, 1)); iso(d) <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = iso(d);
    const month = date.slice(0, 7);
    if (blocks[blocks.length - 1]?.month !== month) blocks.push({ month, cells: [] });
    blocks[blocks.length - 1].cells.push({
      date,
      day: d.getUTCDate(),
      specs: byDate.get(date) ?? [],
    });
  }
  return blocks;
}

/** Сегодняшняя дата по местному времени, 'YYYY-MM-DD'. */
export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Подряд идущие дни без записей сжимаются в одну клетку «3–13»: на виду остаются отпечатки. */
export type Item = { kind: 'day'; cell: DayCell } | { kind: 'gap'; from: DayCell; to: DayCell };

export function compact(cells: DayCell[], today: string): Item[] {
  const items: Item[] = [];
  let run: DayCell[] = [];
  const flush = () => {
    if (run.length >= 2) items.push({ kind: 'gap', from: run[0], to: run[run.length - 1] });
    else run.forEach((cell) => items.push({ kind: 'day', cell }));
    run = [];
  };
  for (const cell of cells) {
    if (!cell.specs.length && cell.date !== today) run.push(cell);
    else {
      flush();
      items.push({ kind: 'day', cell });
    }
  }
  flush();
  return items;
}
