import { describe, expect, it } from 'vitest';
import type { DaySpec } from '../types/dayspec';
import { buildCalendar, compact, localToday } from './calendar';

const day = (date: string, number: number) =>
  ({ date, number, id: `${date}-${number}` }) as DaySpec;

describe('buildCalendar', () => {
  it('идёт подряд от начала первого месяца до сегодня', () => {
    const blocks = buildCalendar([day('2026-10-05', 1), day('2026-11-14', 2)], '2026-11-20');
    expect(blocks.map((b) => b.month)).toEqual(['2026-10', '2026-11']);
    expect(blocks[0].cells).toHaveLength(31);
    expect(blocks[0].cells[0].date).toBe('2026-10-01');
    expect(blocks[1].cells.at(-1)?.date).toBe('2026-11-20');
  });

  it('кладёт записи в свой день, остальные дни пустые', () => {
    const blocks = buildCalendar([day('2026-11-03', 2), day('2026-11-03', 1)], '2026-11-05');
    const cells = blocks[0].cells;
    expect(cells[2].specs.map((s) => s.number)).toEqual([1, 2]);
    expect(cells[3].specs).toEqual([]);
  });

  it('доходит до записи из будущего', () => {
    const blocks = buildCalendar([day('2026-12-02', 1)], '2026-11-30');
    expect(blocks.map((b) => b.month)).toEqual(['2026-11', '2026-12']);
    expect(blocks[1].cells.at(-1)?.date).toBe('2026-12-02');
  });

  it('странная дата не растягивает и не вешает сетку', () => {
    const odd = [day('0202-11-14', 1), day('9999-12-31', 2), day('9999-99-99', 3)];
    const blocks = buildCalendar(odd, '2026-11-20');
    expect(blocks.length).toBeLessThanOrEqual(26);
    const own = blocks.flatMap((b) => b.cells).filter((c) => c.specs.length);
    expect(own.map((c) => c.date)).toEqual(['0202-11-14', '9999-12-31']);
  });

  it('без записей показывает текущий месяц до сегодня', () => {
    const blocks = buildCalendar([], '2026-11-03');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].cells.map((c) => c.day)).toEqual([1, 2, 3]);
  });
});

describe('localToday', () => {
  it('берёт местную дату', () => {
    expect(localToday(new Date(2026, 0, 9, 23, 30))).toBe('2026-01-09');
  });
});

describe('compact', () => {
  const cell = (day: number, filled = false) => ({
    date: `2026-11-${String(day).padStart(2, '0')}`,
    day,
    specs: filled ? [{} as never] : [],
  });

  it('сжимает подряд идущие пустые дни, одиночный пустой и сегодня оставляет', () => {
    const cells = [
      cell(1),
      cell(2),
      cell(3),
      cell(4, true),
      cell(5),
      cell(6, true),
      cell(7),
      cell(8),
    ];
    const items = compact(cells, '2026-11-08');
    expect(items.map((i) => (i.kind === 'gap' ? `${i.from.day}-${i.to.day}` : i.cell.day))).toEqual(
      ['1-3', 4, 5, 6, 7, 8],
    );
  });
});
