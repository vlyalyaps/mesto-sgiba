import { describe, expect, it } from 'vitest';
import { project, springStep } from './spring';

describe('springStep', () => {
  it('приходит к цели без перелёта при damping 1', () => {
    let x = 0;
    let v = 0;
    let max = 0;
    for (let i = 0; i < 240; i++) {
      [x, v] = springStep(x, v, 1, 1 / 120, 0.4, 1);
      max = Math.max(max, x);
    }
    expect(x).toBeCloseTo(1, 3);
    expect(max).toBeLessThanOrEqual(1.0005);
  });
});

describe('project', () => {
  it('быстрый жест летит дальше медленного', () => {
    expect(project(2)).toBeGreaterThan(project(0.5));
    expect(project(-1)).toBeLessThan(0);
  });
});
