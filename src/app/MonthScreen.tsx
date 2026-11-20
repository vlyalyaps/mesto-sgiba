import { useCallback, useMemo, useState } from 'react';
import { FlipThrough } from '../render/FlipThrough';
import { formatDate } from '../render/format';
import { moodLabel, Sticker } from '../render/stickers/Sticker';
import { MonthCover } from './MonthCover';
import { monthTitle, useEntries } from './months';
import { routeHref } from './router';
export function MonthScreen({ month, contents }: { month: string; contents: boolean }) {
  const all = useEntries();
  const days = useMemo(
    () =>
      all
        .filter((e) => e.spec.date.startsWith(month))
        .sort((a, b) => a.spec.date.localeCompare(b.spec.date) || a.spec.number - b.spec.number),
    [all, month],
  );
  const specs = useMemo(() => days.map((e) => e.spec), [days]);
  const [turn, setTurn] = useState<string | null>(null);
  const done = useCallback(() => {
    if (turn) location.hash = routeHref({ name: 'day', id: turn });
  }, [turn]);
  const target = specs.find((s) => s.id === turn);
  const title = monthTitle(month) + ' ' + month.slice(0, 4);
  return (
    <main className="journal-desk month-desk">
      <header className="desk-nav">
        <a href="#/">← Книжная полка</a>
        <span>{title}</span>
      </header>
      {!days.length ? (
        <p>В этом месяце пока нет записей.</p>
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
        <section className="contents-sheet">
          <div className="folio-meta">{title}</div>
          <h1>Оглавление</h1>
          <ol>
            {days.map(({ id, spec }) => {
              const p = spec.photos.find((p) => p.role === 'key') ?? spec.photos[0];
              const mood = spec.page.elements.find((e) => e.kind === 'mood');
              return (
                <li key={id}>
                  <a
                    href={routeHref({ name: 'day', id })}
                    onClick={(e) => {
                      if (
                        e.metaKey ||
                        e.ctrlKey ||
                        e.altKey ||
                        e.shiftKey ||
                        matchMedia('(prefers-reduced-motion: reduce)').matches
                      )
                        return;
                      e.preventDefault();
                      setTurn(id);
                    }}
                  >
                    {p && <img src={p.src} alt="" />}
                    <span>
                      <time>{formatDate(spec.date)}</time>
                      <strong>{spec.folderName}</strong>
                    </span>
                    {mood && (
                      <span className="toc-face" title={moodLabel(mood.mood)}>
                        <Sticker motif={mood.mood} label="настроение" />
                      </span>
                    )}
                    <i aria-hidden="true">↗</i>
                  </a>
                </li>
              );
            })}
          </ol>
        </section>
      )}
      {target && <FlipThrough entries={specs} target={target} done={done} />}
    </main>
  );
}
