import { describe, expect, it } from 'vitest';
import { applyMode, grainAmplitude, modeKey } from './photoModes';
import { parseHex } from './paper';

const duo: [string, string] = ['#25314a', '#f7d296'];
const px = (...rgb: number[]) => new Uint8ClampedArray([...rgb, 255]);

describe('applyMode', () => {
  it('duotone: тени уходят в первую краску, света во вторую', () => {
    const dark = px(0, 0, 0);
    const light = px(255, 255, 255);
    applyMode(dark, 'duotone', duo, 0);
    applyMode(light, 'duotone', duo, 0);
    const [d0, d1] = [parseHex(duo[0]), parseHex(duo[1])];
    expect(Math.abs(dark[0] - d0[0])).toBeLessThanOrEqual(1);
    expect(Math.abs(dark[2] - d0[2])).toBeLessThanOrEqual(1);
    expect(Math.abs(light[0] - d1[0])).toBeLessThanOrEqual(1);
    expect(Math.abs(light[1] - d1[1])).toBeLessThanOrEqual(1);
  });

  it('quiet приглушает насыщенность', () => {
    const a = px(220, 40, 40);
    applyMode(a, 'quiet', duo, 0);
    expect(Math.max(a[0], a[1], a[2]) - Math.min(a[0], a[1], a[2])).toBeLessThan(180);
  });

  it('film поднимает чёрный: выцветание', () => {
    const a = px(0, 0, 0);
    applyMode(a, 'film', duo, 0);
    expect(a[0]).toBeGreaterThan(5);
  });

  it('warm сдвигает серое к тёплому', () => {
    const a = px(128, 128, 128);
    applyMode(a, 'warm', duo, 0);
    expect(a[0]).toBeGreaterThan(a[2]);
  });

  it('один вход даёт один результат, зерно зависит от зерна дня', () => {
    const make = () => new Uint8ClampedArray(64 * 4).fill(120);
    const x = make();
    const y = make();
    applyMode(x, 'film', duo, 0.5, 7);
    applyMode(y, 'film', duo, 0.5, 7);
    expect(Array.from(x)).toEqual(Array.from(y));
    const z = make();
    applyMode(z, 'quiet', duo, 0, 7);
    expect(new Set(z).size).toBeLessThan(new Set(x).size);
  });
});

describe('кэш', () => {
  it('ключ различает режим, краски duo (только в duotone) и зерно', () => {
    expect(modeKey('a', 'warm', duo, 0.3)).not.toBe(modeKey('a', 'film', duo, 0.3));
    expect(modeKey('a', 'warm', duo, 0.3)).toBe(modeKey('a', 'warm', ['#000000', '#ffffff'], 0.3));
    expect(modeKey('a', 'duotone', duo, 0.3)).not.toBe(
      modeKey('a', 'duotone', ['#000000', '#ffffff'], 0.3),
    );
    expect(modeKey('a', 'warm', duo, 0.3)).not.toBe(modeKey('a', 'warm', duo, 0.6));
  });

  it('зерно на фото сильнее у плёнки', () => {
    expect(grainAmplitude('film', 0.5)).toBeGreaterThan(grainAmplitude('quiet', 0.5));
  });
});
