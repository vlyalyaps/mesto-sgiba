import type { CutAlphabet } from '../types/dayspec';
import { cutWords } from '../rules/titleLetters';

export function CutTitle({ title, sets, id }: { title: string; sets: CutAlphabet[]; id: string }) {
  const words = cutWords(title, sets, id);
  const weights = words.map((word) => word.reduce((w, l) => w + l.width, 0));
  const half = weights.reduce((sum, w) => sum + w, 0) / 2;
  let split = 1,
    total = 0,
    best = Infinity;
  for (let i = 0; i < weights.length - 1; i++) {
    total += weights[i];
    if (Math.abs(total - half) < best) {
      best = Math.abs(total - half);
      split = i + 1;
    }
  }
  const rows = [words.slice(0, split), words.slice(split)].filter((row) => row.length);
  return (
    <div className="cut-title" role="img" aria-label={title}>
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
                  transform: `translateY(${lift}%) rotate(${rotation}deg) scaleY(${height})`,
                };
                return /^[а-яё]$/iu.test(char) ? (
                  <img
                    key={j}
                    style={style}
                    alt=""
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
