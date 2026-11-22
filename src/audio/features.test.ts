import { describe, expect, it } from 'vitest';
import {
  beatGrid,
  energyOf,
  estimateTempo,
  features,
  peakSecOf,
  rmsWindows,
  toMono,
} from './features';

const SR = 22050;

/** Щелчки (30 мс, 1 кГц) каждые 60/bpm секунд; громкость растёт до peakAt, потом падает. */
function clicks(bpm: number, seconds: number, peakAt: number, firstAt = 0.1): Float32Array {
  const out = new Float32Array(Math.round(SR * seconds));
  const burst = Math.round(SR * 0.03);
  for (let t = firstAt; t < seconds; t += 60 / bpm) {
    const gain = t <= peakAt ? 0.1 + (0.9 * t) / peakAt : 0.25;
    const start = Math.round(t * SR);
    for (let i = 0; i < burst && start + i < out.length; i++) {
      out[start + i] = gain * Math.sin((2 * Math.PI * 1000 * i) / SR) * Math.exp(-i / (burst / 3));
    }
  }
  return out;
}

describe('features на синтетике', () => {
  const samples = clicks(120, 30, 20);
  const f = features(samples, SR);

  it('темп около 120 уд/мин', () => {
    expect(f.bpm).toBeGreaterThan(118);
    expect(f.bpm).toBeLessThan(122);
  });
  it('пик громкости около 20-й секунды', () => {
    expect(f.peakSec).toBeGreaterThan(19);
    expect(f.peakSec).toBeLessThan(21);
  });
  it('доли идут с шагом 0,5 с от первого щелчка до конца', () => {
    const beats = f.beats ?? [];
    expect(beats.length).toBeGreaterThanOrEqual(58);
    expect(beats.length).toBeLessThanOrEqual(61);
    expect(beats[0]).toBeGreaterThanOrEqual(0);
    expect(beats[0]).toBeLessThan(0.5);
    expect(beats[1] - beats[0]).toBeCloseTo(0.5, 1);
    expect(beats[beats.length - 1]).toBeLessThan(30);
  });
  it('energy и energySpread в 0..1, measured', () => {
    expect(f.energy).toBeGreaterThan(0);
    expect(f.energy).toBeLessThanOrEqual(1);
    expect(f.energySpread).toBeGreaterThan(0);
    expect(f.energySpread).toBeLessThanOrEqual(1);
    expect(f.measured).toBe(true);
  });
});

describe('estimateTempo', () => {
  it('другие темпы: 90 и 150', () => {
    const t90 = estimateTempo(clicks(90, 30, 20), SR).bpm;
    const t150 = estimateTempo(clicks(150, 30, 20), SR).bpm;
    expect(t90).toBeGreaterThan(88);
    expect(t90).toBeLessThan(92);
    expect(t150).toBeGreaterThan(147);
    expect(t150).toBeLessThan(153);
  });
  it('фаза: первая доля там, где щелчок', () => {
    const t = estimateTempo(clicks(120, 30, 20, 0.3), SR);
    expect(Math.abs(t.offset - 0.3)).toBeLessThan(0.1);
  });
  it('тишина и слишком короткий звук не ломают', () => {
    expect(estimateTempo(new Float32Array(SR * 30), SR).bpm).toBe(100);
    expect(estimateTempo(new Float32Array(100), SR).bpm).toBe(100);
  });
});

describe('громкость', () => {
  it('energy: шкала −40…−6 дБ', () => {
    const quiet = new Float32Array(SR * 2).fill(0.001);
    expect(energyOf(rmsWindows(quiet, SR))).toBe(0);
    const loud = new Float32Array(SR * 2).fill(0.5); // −6 дБ
    expect(energyOf(rmsWindows(loud, SR))).toBeCloseTo(1, 1);
    const mid = new Float32Array(SR * 2).fill(0.05); // −26 дБ
    expect(energyOf(rmsWindows(mid, SR))).toBeCloseTo(14 / 34, 2);
  });
  it('у ровного звука нет разброса громкости', () => {
    const flat = new Float32Array(SR * 5).fill(0.2);
    expect(features(flat, SR).energySpread).toBe(0);
  });
  it('пик не берётся из первой и последней секунды', () => {
    const s = new Float32Array(SR * 10).fill(0.1);
    s.fill(1, 0, SR); // громкое вступление
    s.fill(1, SR * 9); // и громкий хвост
    s.fill(0.5, SR * 5, SR * 6);
    const p = peakSecOf(rmsWindows(s, SR));
    expect(p).toBeGreaterThan(4.5);
    expect(p).toBeLessThan(6.5);
  });
  it('короткий звук: пик всё равно находится', () => {
    expect(peakSecOf(rmsWindows(new Float32Array(SR).fill(0.1), SR))).toBeGreaterThan(0);
    expect(peakSecOf([])).toBe(0);
  });
});

describe('вспомогательное', () => {
  it('beatGrid: offset + k·шаг до конца', () => {
    expect(beatGrid({ bpm: 120, offset: 0.25 }, 2)).toEqual([0.25, 0.75, 1.25, 1.75]);
    expect(beatGrid({ bpm: 0, offset: 0 }, 5)).toEqual([]);
    expect(beatGrid({ bpm: 60, offset: -0.2 }, 3)[0]).toBeCloseTo(0.8, 3);
  });
  it('toMono усредняет каналы', () => {
    const m = toMono([new Float32Array([1, 0]), new Float32Array([0, 1])]);
    expect([...m]).toEqual([0.5, 0.5]);
  });
});
