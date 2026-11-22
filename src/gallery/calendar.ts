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

/** Столько месяцев показываем подряд; что старше — только месяцы с записями. */
const RUN = 24;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-\d\d$/;
const pad = (n: number, width = 2) => String(n).padStart(width, '0');
const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;

/**
 * Все дни подряд, как в галерее: от первого числа самого раннего месяца с записью
 * до сегодня (или до последней записи, если она позже), сгруппированные по месяцам.
 */
export function buildCalendar(specs: DaySpec[], today: string): MonthBlock[] {
  const byDate = new Map<string, DaySpec[]>();
  for (const s of [...specs].sort((a, b) => a.number - b.number))
    byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  const dates = [...byDate.keys(), today].filter((date) => DATE.test(date)).sort();
  const end = dates[dates.length - 1];
  const last = monthIndex(end);
  const from = Math.max(monthIndex(dates[0]), last - RUN + 1);
  const months = [...new Set(dates.map(monthIndex).filter((m) => m < from))];
  for (let m = from; m <= last; m++) months.push(m);
  return months.map((index) => {
    const year = Math.floor(index / 12);
    const month = `${pad(year, 4)}-${pad((index % 12) + 1)}`;
    // setUTCFullYear, а не Date.UTC: тот читает годы 0–99 как 1900–1999.
    const size = new Date(new Date(0).setUTCFullYear(year, (index % 12) + 1, 0)).getUTCDate();
    const cells: DayCell[] = [];
    for (let day = 1; day <= size; day++) {
      const date = `${month}-${pad(day)}`;
      if (date > end) break;
      cells.push({ date, day, specs: byDate.get(date) ?? [] });
    }
    return { month, cells };
  });
}

/** Сегодняшняя дата по местному времени, 'YYYY-MM-DD'. */
export function localToday(now = new Date()): string {
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
