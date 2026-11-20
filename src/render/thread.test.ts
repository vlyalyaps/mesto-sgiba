import { describe, expect, it } from 'vitest';
import { fixtures } from '../fixtures';
import { buildDaySpec } from '../rules';
import { planBook, revealWindow } from './geometry';
import { causeMarks, markText, songThread } from './thread';

const spec = (n: number) => buildDaySpec(fixtures.find((f) => f.input.number === n)!.input);

describe('songThread', () => {
  it('ставит пик на сгиб разворота, а доли раскрытия — на складки', () => {
    const s = spec(47);
    const plan = planBook(s);
    const win = revealWindow(s.reveal.durationMs, s.reveal.peakSec!, s.reveal.prerollSec);
    const t = songThread(plan, s, win)!;
    expect(t).not.toBeNull();
    expect(t.ticks.some((k) => Math.abs(k.x - t.gutter) < 1e-6 || k.x < t.gutter)).toBe(true);
    expect(t.ticks.every((k) => k.x > t.starts[1])).toBe(true);
    expect(t.ticks.filter((k) => k.down).length).toBeGreaterThan(0);
  });

  it('без песни нити нет', () => {
    const s = { ...spec(47), reveal: { ...spec(47).reveal, peakSec: null } };
    expect(songThread(planBook(s), s, 2)).toBeNull();
  });
});

describe('слова-причины', () => {
  it('находит слова из «Почему так» и помечает их в тексте', () => {
    const s = spec(49);
    const marks = causeMarks(s.why);
    expect(marks.get('тихо')).toMatch(/поля/i);
    const seg = markText('Тихо. Чай у окна вокзала.', marks);
    expect(seg.find((x) => x.text === 'Тихо')?.note).toBeTruthy();
    expect(seg.map((x) => x.text).join('')).toBe('Тихо. Чай у окна вокзала.');
  });
});
