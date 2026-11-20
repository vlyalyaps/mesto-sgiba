import { describe, expect, it } from 'vitest';
import { contrast, parseHex, readableInk, shadeStrength, toneColor } from './paper';

describe('toneColor', () => {
  it('холодный тон синее тёплого, тёплый краснее', () => {
    const cold = parseHex(toneColor(-1));
    const warm = parseHex(toneColor(1));
    expect(cold[2] - cold[0]).toBeGreaterThan(0);
    expect(warm[0] - warm[2]).toBeGreaterThan(20);
  });

  it('яркость делает бумагу светлее, а возраст желтит', () => {
    const dim = parseHex(toneColor(0, 0));
    const bright = parseHex(toneColor(0, 1));
    expect(bright[1]).toBeGreaterThan(dim[1]);
    const old = parseHex(toneColor(0, 0.6, 1));
    const fresh = parseHex(toneColor(0, 0.6, 0));
    expect(old[2]).toBeLessThan(fresh[2]);
  });

  it('всегда возвращает #rrggbb, даже вне диапазона', () => {
    expect(toneColor(5, 9, 9)).toMatch(/^#[0-9a-f]{6}$/);
    expect(toneColor(-5, -9, -9)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('readableInk', () => {
  it('оставляет читаемую краску как есть', () => {
    expect(readableInk('#7a2f22', '#ece0cd')).toBe('#7a2f22');
  });

  it('затемняет светлую краску до читаемого контраста', () => {
    const out = readableInk('#e9e6df', '#ece0cd');
    expect(contrast(parseHex(out), parseHex('#ece0cd'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('shadeStrength', () => {
  it('растёт с paper.shadow', () => {
    expect(shadeStrength(1)).toBeGreaterThan(shadeStrength(0));
  });
});
