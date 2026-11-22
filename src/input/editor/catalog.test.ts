import { describe, expect, it } from 'vitest';
import { fixtures } from '../../fixtures';
import { buildDaySpec } from '../../rules';
import { EMPTY_DESIGN, sheetItems } from '../../rules/sheet';
import type { DayInput, SongInput } from '../../types/dayspec';
import { cutoutByKey, GROUPS } from './catalog';
import type { Editor } from './context';
import { nameOf } from './names';

describe('каталог редактора', () => {
  it('у каждой вклейки свой ключ', () => {
    const cuts = GROUPS.flatMap((group) => group.items);
    expect(new Set(cuts.map((cut) => cut.key)).size).toBe(cuts.length);
    for (const cut of cuts) expect(cutoutByKey(cut.key)).toBe(cut);
  });

  it('любая деталь, которую кладут правила, названа по-человечески', () => {
    const base = fixtures[0].input;
    const song = base.song as SongInput;
    const words = [
      'Бежали. А потом два стакана чая на чемодане у поезда. Мы рядом.',
      'Горы, цветы и листья. Солнце над тропой.',
      'Кино, кот и дождь. Один.',
      'Были на концерте. Автобус опоздал, ужинали в кафе.',
    ];
    const days: DayInput[] = fixtures.map((f) => f.input);
    for (const text of words)
      for (const count of [1, 2, 3])
        for (const energy of [0.2, 0.6, 0.9])
          for (const [year, genre] of [
            [1975, 'Classical'],
            [1990, 'Rock'],
            [2001, 'Dance'],
          ] as const)
            days.push({
              ...base,
              text,
              photos: Array.from({ length: count }, (_, i) => ({ ...base.photos[0], id: `p${i}` })),
              song: {
                ...song,
                year,
                genre,
                features: { bpm: 120, energy, energySpread: 0.2, peakSec: 8, measured: false },
              },
            });

    const nameless = new Set<string>();
    for (const day of days) {
      const spec = buildDaySpec(day);
      for (const item of sheetItems(EMPTY_DESIGN, spec.page))
        if (nameOf(item, { spec } as Editor) === 'Деталь листа' && item.kind === 'sticker')
          nameless.add(item.motif);
    }
    expect([...nameless]).toEqual([]);
  });
});
