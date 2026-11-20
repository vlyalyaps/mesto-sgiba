import { useEffect, useState } from 'react';
import { Cover } from '../render/Cover';
import { Skeleton } from '../ui/Skeleton';
import { demoArchive, loadArchive, type ArchiveEntry } from './days';
import { routeHref } from './router';

export function ArchiveScreen() {
  const [entries, setEntries] = useState<ArchiveEntry[] | null>(demoArchive);

  useEffect(() => {
    let live = true;
    void loadArchive().then((e) => {
      if (live) setEntries(e);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <main className="archive">
      <header className="archive-head">
        <h1>Место сгиба</h1>
        <p className="lede">Дневник, который складывает день в книжку-гармошку.</p>
        <a className="btn btn-primary" href={routeHref({ name: 'new' })}>
          Записать день
        </a>
      </header>

      <ol className="covers" aria-label="Архив дней" aria-busy={entries === null}>
        {entries === null
          ? [0, 1, 2].map((i) => (
              <li key={i}>
                <Skeleton className="cover-skeleton" />
              </li>
            ))
          : entries.map((e) => (
              <li key={e.id}>
                <a className="cover-link" href={routeHref({ name: 'day', id: e.id })}>
                  <Cover spec={e.spec} vt />
                </a>
              </li>
            ))}
      </ol>
    </main>
  );
}
