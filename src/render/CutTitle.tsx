import type { CutAlphabet } from '../types/dayspec';
import { cutWords } from '../rules/titleLetters';

/** Буквы чуть ниже своей строки: между строками больше воздуха, заголовок легче читать. */
const SQUEEZE = 0.9;

export function CutTitle({ title, sets, id }: { title: string; sets: CutAlphabet[]; id: string }) {
  const words = cutWords(title, sets, id);
  const weights = words.map((word) => word.reduce((w, l) => w + l.width, 0));
  const total = weights.reduce((sum, w) => sum + w, 0);
  // Длинное название в две строки сжимает буквы так, что его трудно прочесть: берём три.
  const letters = words.reduce((n, word) => n + word.length, 0);
  const count = letters > 24 && words.length >= 4 ? 3 : Math.min(2, words.length);
  const cuts: number[] = [];
  let sum = 0;
  for (let i = 0, k = 1; i < weights.length - 1 && k < count; i++) {
    const next = sum + weights[i];
    const target = (total * k) / count;
    // Режем там, где накопленная ширина ближе всего к нужной доле строки.
    if (Math.abs(next - target) <= Math.abs(next + weights[i + 1] - target)) {
      cuts.push(i + 1);
      k++;
    }
    sum = next;
  }
  const rows = [0, ...cuts, words.length]
    .slice(0, -1)
    .map((from, r) => words.slice(from, [...cuts, words.length][r]))
    .filter((row) => row.length);
  return (
    <div
      className={rows.length > 2 ? 'cut-title cut-title-3' : 'cut-title'}
      role="img"
      aria-label={title}
    >
      {rows.map((row, r) => (
        <div key={r} className="cut-line" aria-hidden="true">
          {row.map((word, i) => (
            <span
              key={i}
              className="cut-word"
              style={{ flexGrow: word.reduce((w, l) => w + l.width, 0) }}
            >
              {word.map(({ char, alphabet, rotation, lift, height, width }, j) => {
                const style = {
                  flexGrow: width,
                  transform: `translateY(${lift}%) rotate(${rotation}deg) scaleY(${(height * SQUEEZE).toFixed(3)})`,
                };
                return /^[а-яё]$/iu.test(char) ? (
                  <img
                    key={j}
                    style={style}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    src={`${import.meta.env.BASE_URL}letters/${alphabet}/${char.codePointAt(0)!.toString(16)}.webp`}
                  />
                ) : (
                  <span className="cut-fallback" style={style} key={j}>
                    {char}
                  </span>
                );
              })}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
