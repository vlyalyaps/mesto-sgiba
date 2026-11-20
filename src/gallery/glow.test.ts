import { describe, expect, it } from 'vitest';
import { beatSeconds, dayGlow } from './glow';

const saturation = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return Math.max(...c) - Math.min(...c);
};

describe('dayGlow', () => {
  it('берёт самый выраженный цвет снимков и делает его ярким', () => {
    const glow = dayGlow({ ink: '#866545', duo: ['#151515', '#efb47c'] });
    expect(glow).toMatch(/^#[0-9a-f]{6}$/);
    expect(saturation(glow)).toBeGreaterThan(120);
    // Оттенок тёплый, как у персикового света: красного больше, чем синего.
    expect(parseInt(glow.slice(1, 3), 16)).toBeGreaterThan(parseInt(glow.slice(5, 7), 16));
  });

  it('серые снимки дают сдержанное свечение', () => {
    expect(saturation(dayGlow({ ink: '#777777', duo: ['#111111', '#eeeeee'] }))).toBeLessThan(80);
  });

  it('разные снимки — разное свечение, одинаковые — одно и то же', () => {
    const a = dayGlow({ ink: '#985d38', duo: ['#5a2318', '#f3ede3'] });
    expect(a).toBe(dayGlow({ ink: '#985d38', duo: ['#5a2318', '#f3ede3'] }));
    expect(a).not.toBe(dayGlow({ ink: '#3a6f8a', duo: ['#0d2a3a', '#d9eef5'] }));
  });
});

describe('beatSeconds', () => {
  it('берёт обычный промежуток между долями', () => {
    expect(beatSeconds([0, 0.5, 1, 1.5, 2.6, 3.1])).toBe(0.5);
  });
  it('без долей — спокойный шаг', () => {
    expect(beatSeconds([])).toBe(0.75);
  });
});
