/** Мелкие чистые помощники для правил: числа, слова, русские формы. */

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function round(v: number, digits = 3): number {
  const k = 10 ** digits;
  return Math.round(v * k) / k;
}

const WORD = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu;

/** Слова текста с исходным регистром. */
export function rawWords(text: string): string[] {
  return text.match(WORD) ?? [];
}

export function fold(word: string): string {
  return word.toLowerCase().replace(/ё/g, 'е');
}

/** Слова в нижнем регистре, «ё» → «е»: так словарь не зависит от написания. */
export function lowerWords(text: string): string[] {
  return rawWords(text).map(fold);
}

export function wordCount(text: string): number {
  return rawWords(text).length;
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Число с запятой: 1,9. */
export function fmt(n: number, digits = 1): string {
  return n.toFixed(digits).replace('.', ',');
}

/** «а», «б» и «в». Без повторов, не больше max слов. */
export function quoteList(words: string[], max = 3): string {
  const uniq = [...new Set(words)].slice(0, max).map((w) => `«${w}»`);
  if (uniq.length <= 1) return uniq.join('');
  return `${uniq.slice(0, -1).join(', ')} и ${uniq[uniq.length - 1]}`;
}

/** «около 121 удара», «около 123 ударов»: родительный падеж после «около». */
export function beatsPhrase(bpm: number): string {
  const n = Math.round(bpm);
  const one = n % 10 === 1 && n % 100 !== 11;
  return `около ${n} ${one ? 'удара' : 'ударов'} в минуту`;
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
