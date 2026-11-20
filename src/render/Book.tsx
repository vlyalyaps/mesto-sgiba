import type { DaySpec } from '../types/dayspec';
import { Cover } from './Cover';

/** Книжка-гармошка. Временная версия: только порядок фраз, без сгибов и звука. */
export function Book({ spec }: { spec: DaySpec }) {
  const before = spec.folds.filter((f) => f.side === 'before');
  const after = spec.folds.filter((f) => f.side === 'after');
  return (
    <article className="book-draft">
      <Cover spec={spec} />
      <ol className="book-draft-text">
        {before.map((f) => (
          <li key={f.sentence}>{f.text}</li>
        ))}
        <li className="book-draft-key">{spec.key.text}</li>
        {after.map((f) => (
          <li key={f.sentence}>{f.text}</li>
        ))}
      </ol>
    </article>
  );
}
