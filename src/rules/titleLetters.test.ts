import { describe, expect, it } from 'vitest';
import { fixtures } from '../fixtures';
import { buildDaySpec } from './index';
import { cutWords, selectAlphabets } from './titleLetters';
import { heartTrigger } from './reference047';

const demo = fixtures.find((f) => f.input.number === 47)!.input;
describe('вырезанные буквы эталона', () => {
  it('год и жанр меняют материалы, а причина попадает в DaySpec', () => {
    const spec = buildDaySpec(demo);
    expect(spec.page.titleAlphabets).toEqual(['emboss', 'pixel', 'gloss', 'news', 'xerox']);
    expect(spec.why.find((w) => w.param === 'page.reference.lettering')?.text).toMatch(
      /Dance, 2001.*тиснёная лента/,
    );
    expect(selectAlphabets({ genre: 'Classical', year: 1982 }).alphabets).toEqual([
      'book',
      'typewriter',
      'news',
      'xerox',
      'stencil',
    ]);
    expect(selectAlphabets({ genre: 'Pop', year: 1982 }).alphabets).not.toEqual(
      selectAlphabets({ genre: 'Pop', year: 2001 }).alphabets,
    );
    expect(selectAlphabets(null).alphabets.length).toBeGreaterThan(1);
  });
  it('буквы и регистр сохраняются, соседние наборы чередуются по семени', () => {
    const spec = buildDaySpec(demo);
    const sets = spec.page.titleAlphabets!;
    const title = 'Ёж и ещё один ёж';
    const words = cutWords(title, sets, spec.id);
    expect(words.map((w) => w.map((l) => l.char).join('')).join(' ')).toBe(title);
    expect(cutWords(title, sets, spec.id)).toEqual(words);
    expect(cutWords(title, sets, 'другой день')).not.toEqual(words);
    for (const word of words)
      for (let i = 1; i < word.length; i++) expect(word[i].alphabet).not.toBe(word[i - 1].alphabet);
  });
  it('сердце появляется по одному из оговорённых признаков текста', () => {
    expect(heartTrigger(demo.text)).toBe('рядом');
    expect(heartTrigger('Мы опоздали.')).toBe('мы');
    expect(heartTrigger('На перроне встретил Анну.')).toBe('Анну');
    expect(heartTrigger('Вместе с чемоданом.')).toBeUndefined();
    expect(heartTrigger('Взял чай.')).toBeUndefined();
  });
});
