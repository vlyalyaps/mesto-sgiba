import { describe, expect, it } from 'vitest';
import { fixtures } from '../fixtures';
import { buildDaySpec } from '../rules';
import {
  HALF_W,
  anglesAt,
  audioProgress,
  beatSchedule,
  chainExtent,
  fitFont,
  fitRegion,
  layoutSpread,
  openAngles,
  planBook,
  revealWindow,
  steppedProgress,
  stepsDuration,
} from './geometry';

const spec = buildDaySpec(fixtures[0].input);

describe('planBook', () => {
  const plan = planBook(spec);

  it('обложка, складки до и после, две половины разворота', () => {
    expect(plan[0].kind).toBe('cover');
    expect(plan.filter((q) => q.kind === 'half')).toHaveLength(2);
    const strips = spec.rhythm.beatsPerFold === 4 ? 2 : 1;
    expect(plan.filter((q) => q.kind === 'fold')).toHaveLength(spec.folds.length * strips);
    expect(plan.find((q) => q.side === 'L')!.w).toBe(HALF_W);
  });

  it('сложенная книжка ложится стопкой: углы 0 и 180', () => {
    for (const q of plan) expect([0, 180]).toContain(q.closedA);
  });

  it('раскрытые углы складок чередуют знак: зигзаг, а не веер', () => {
    const run = plan.filter((q) => q.kind !== 'half');
    for (let i = 1; i < run.length; i++) {
      if (plan.indexOf(run[i]) === plan.indexOf(run[i - 1]) + 1) {
        expect(Math.sign(run[i].openA)).toBe(-Math.sign(run[i - 1].openA));
      }
    }
  });

  it('узкая складка не бывает тоньше минимума', () => {
    for (const q of plan.filter((p) => p.kind === 'fold')) expect(q.w).toBeGreaterThanOrEqual(0.1);
  });

  it('прогресс 0 даёт закрытые углы, 1 — раскрытые', () => {
    expect(anglesAt(plan, 0)).toEqual(plan.map((q) => q.closedA));
    anglesAt(plan, 1).forEach((a, i) => expect(a).toBeCloseTo(openAngles(plan)[i], 6));
  });

  it('сложенная книжка не шире обложки, раскрытая заметно шире', () => {
    const closed = chainExtent(plan, anglesAt(plan, 0));
    const open = chainExtent(plan, anglesAt(plan, 1));
    expect(closed.max - closed.min).toBeLessThan(1);
    expect(open.max - open.min).toBeGreaterThan(closed.max - closed.min);
  });
});

describe('layoutSpread', () => {
  const base = { overlap: false, keySlot: 1 };
  it('окно: один кадр на весь разворот', () => {
    const l = layoutSpread({ ...base, layout: 'window', count: 1, keySlot: 0 }, 300, 384, 15);
    expect(l.frames).toHaveLength(1);
    expect(l.frames[0].w).toBe(384 - 30);
  });

  it('диптих: два кадра, главный справа, сгиб приходится на зазор', () => {
    const l = layoutSpread({ ...base, layout: 'diptych', count: 2 }, 300, 384, 15);
    expect(l.frames.map((f) => f.slot)).toEqual([0, 1]);
    expect(l.frames[0].x + l.frames[0].w).toBeLessThan(192);
    expect(l.frames[1].x).toBeGreaterThan(192);
  });

  it('внахлёст кадры перекрываются через сгиб и лежат с наклоном', () => {
    const l = layoutSpread({ ...base, overlap: true, layout: 'diptych', count: 2 }, 300, 384, 15);
    expect(l.frames[0].x + l.frames[0].w).toBeGreaterThan(l.frames[1].x);
    expect(l.frames.every((f) => f.rot !== 0 && f.bordered)).toBe(true);
  });

  it('контактный лист: главный сверху и ряд поменьше ниже, не больше 4', () => {
    const l = layoutSpread({ ...base, layout: 'contact', count: 5, keySlot: 4 }, 300, 384, 15);
    expect(l.frames).toHaveLength(5);
    expect(l.frames[0].slot).toBe(4);
    expect(l.frames[1].y).toBeGreaterThan(l.frames[0].y + l.frames[0].h);
    expect(l.textTop).toBeGreaterThan(l.frames[1].y + l.frames[1].h);
  });

  it('без фото кадров нет', () => {
    expect(layoutSpread({ ...base, layout: 'window', count: 0 }, 300, 384, 15).frames).toEqual([]);
  });
});

describe('fitRegion', () => {
  it('закрывает окно целиком и не выходит за картинку', () => {
    for (const region of [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 0.7, y: 0.6, w: 0.3, h: 0.4 },
      { x: -0.2, y: 0.4, w: 1, h: 1 },
    ]) {
      const f = fitRegion(800, 1000, 2, 1, region);
      expect(f.left).toBeLessThanOrEqual(0);
      expect(f.top).toBeLessThanOrEqual(0);
      expect(f.left + f.width).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(f.top + f.height).toBeGreaterThanOrEqual(1 - 1e-9);
    }
  });

  it('фрагмент приближает: меньший crop даёт больший масштаб', () => {
    const whole = fitRegion(1000, 800, 1, 1, { x: 0, y: 0, w: 1, h: 1 });
    const crop = fitRegion(1000, 800, 1, 1, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    expect(crop.width).toBeCloseTo(whole.width * 2, 5);
  });
});

describe('fitFont', () => {
  it('длинная фраза получает меньший кегль, чем короткая', () => {
    const short = fitFont('Два стакана', 340, 90, 28, 11);
    const long = fitFont(
      'Впервые за неделю сидели рядом целый час и никуда не спешили',
      340,
      90,
      28,
      11,
    );
    expect(long).toBeLessThan(short);
    expect(long).toBeGreaterThanOrEqual(11);
  });
});

describe('время раскрытия', () => {
  it('со звуком разворот раскрыт ровно на пике', () => {
    const peak = 21;
    const win = revealWindow(2000, peak, 4);
    expect(audioProgress(peak, peak, win)).toBe(1);
    expect(audioProgress(peak - win, peak, win)).toBe(0);
    expect(audioProgress(peak - win / 2, peak, win)).toBeCloseTo(0.5, 5);
    expect(audioProgress(peak + 3, peak, win)).toBe(1);
    expect(audioProgress(0, peak, win)).toBe(0);
  });

  it('окно не длиннее разбега до пика', () => {
    expect(revealWindow(9000, 21, 4)).toBe(4);
    expect(revealWindow(2000, 1, 4)).toBeLessThanOrEqual(1);
  });

  it('без звука шаги идут по сильным долям и заканчиваются единицей', () => {
    const steps = beatSchedule([2, 2.5, 3, 3.5, 4], 1000);
    expect(steps[0].at).toBe(0);
    expect(steps.at(-1)!.at).toBe(1000);
    expect(steps.at(-1)!.to).toBe(1);
    expect(steps.every((s, i) => i === 0 || s.at > steps[i - 1].at)).toBe(true);
    expect(beatSchedule([3], 1000)).toEqual([]);
  });

  it('шаги дают лестницу прогресса от 0 до 1', () => {
    const steps = beatSchedule([0, 1, 2, 3], 1500);
    expect(steppedProgress(steps, 0)).toBe(0);
    expect(steppedProgress(steps, stepsDuration(steps))).toBeCloseTo(1, 5);
    let last = 0;
    for (let t = 0; t <= stepsDuration(steps); t += 20) {
      const p = steppedProgress(steps, t);
      expect(p).toBeGreaterThanOrEqual(last - 1e-9);
      last = p;
    }
  });
});
