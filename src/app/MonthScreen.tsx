import { useCallback, useMemo, useState } from 'react';
import { BookBinding } from '../render/BookBinding';
import { FlipThrough } from '../render/FlipThrough';
import { BookIndex } from './BookIndex';
import { MonthCover } from './MonthCover';
import { entryCount, monthTitle, useEntries } from './months';
import { landOnDay, routeHref } from './router';

export function MonthScreen({ month, contents }: { month: string; contents: boolean }) {
  const all = useEntries();
  const days = useMemo(
    () => all.filter((entry) => entry.spec.date.startsWith(month)).reverse(),
    [all, month],
  );
  const specs = useMemo(() => days.map(({ spec }) => spec), [days]);
  const [turn, setTurn] = useState<string | null>(null);
  const done = useCallback(() => {
    if (turn) landOnDay(turn);
  }, [turn]);
  const targets = useMemo(() => {
    const count = specs.findIndex((spec) => spec.id === turn) + 1;
    if (count <= 14) return specs.slice(0, count);
    return Array.from({ length: 14 }, (_, i) => specs[Math.floor(((count - 1) * i) / 13)]);
  }, [specs, turn]);
  const title = monthTitle(month) + ' ' + month.slice(0, 4);
  const coverHref = routeHref({ name: 'month', month, contents: false });
  return (
    <main className="journal-desk month-desk">
      <header className="desk-nav">
        <a href="#/">← Книжная полка</a>
        {contents ? <a href={coverHref}>Обложка</a> : <span>{title}</span>}
      </header>
      {!days.length ? (
        <p className="placeholder">В этом месяце пока нет записей.</p>
      ) : !contents ? (
        <section className="cover-on-desk">
          <a
            aria-label="Открыть оглавление"
            href={routeHref({ name: 'month', month, contents: true })}
          >
            <MonthCover month={month} entries={days} />
            <span className="open-index">Открыть оглавление &nbsp; →</span>
          </a>
        </section>
      ) : (
        <article className="sketch-day">
          <header className="entry-heading index-heading">
            <div className="folio-meta">{entryCount(days.length)}</div>
            <h1>{title}</h1>
          </header>
          <BookBinding month={month} contents>
            <BookIndex days={specs} title={title} onTurn={setTurn} />
            {targets.length > 0 && <FlipThrough entries={targets} done={done} />}
          </BookBinding>
        </article>
      )}
    </main>
  );
}
