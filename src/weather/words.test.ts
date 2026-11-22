import { describe, expect, it } from 'vitest';
import { weatherFall, weatherWord } from './words';

describe('погода словами', () => {
  it('ясное небо днём — солнечно, ночью — ясно', () => {
    expect(weatherWord(0, 13)).toBe('Солнечно');
    expect(weatherWord(0, 22)).toBe('Ясно');
  });
  it('облачность, осадки и туман', () => {
    expect(weatherWord(3)).toBe('Пасмурно');
    expect(weatherWord(45)).toBe('Туман');
    expect(weatherWord(63)).toBe('Дождь');
    expect(weatherWord(73)).toBe('Снег');
    expect(weatherWord(95)).toBe('Гроза');
  });
  it('что падает с неба', () => {
    expect(weatherFall(75)).toBe('snow');
    expect(weatherFall(81)).toBe('rain');
    expect(weatherFall(2)).toBeNull();
  });
});
