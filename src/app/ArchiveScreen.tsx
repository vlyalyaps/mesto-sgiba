import { useEntries, monthTitle } from './months';
import { MonthCover } from './MonthCover';
import { routeHref } from './router';
export function ArchiveScreen() {
  const entries = useEntries();
  const months = [...new Set(entries.map((e) => e.spec.date.slice(0, 7)))];
  return (
    <main className="journal-desk shelf-screen">
      <header className="journal-bar">
        <h1>
          <svg viewBox="0 0 40 34" aria-hidden="true">
            <path d="M3 6q9-3 16 2 8-6 18-4l-1 23q-9-1-16 4-7-5-17-3zM19 9l1 22m-26-16" />
          </svg>
          Место сгиба
        </h1>
        <a className="ink-button" href="#/gallery">
          Дни сеткой
        </a>
        <a className="ink-button" href="#/new">
          <span aria-hidden="true">＋</span> Записать день
        </a>
      </header>
      <section className="shelf-content">
        <h2>
          Книжная полка<span aria-hidden="true">.</span>
        </h2>
        <ol className="month-shelf" aria-label="Книги по месяцам">
          {months.map((month) => (
            <li key={month}>
              <a
                href={routeHref({ name: 'month', month, contents: false })}
                aria-label={`Открыть книгу: ${monthTitle(month)} ${month.slice(0, 4)}`}
              >
                <MonthCover
                  month={month}
                  entries={entries.filter((e) => e.spec.date.startsWith(month))}
                />
              </a>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
