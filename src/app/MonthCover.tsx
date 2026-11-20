import type { CSSProperties } from 'react';
import type { ArchiveEntry } from './days';
import { entryCount, monthTitle } from './months';
import './shelf.css';
export function MonthCover({ month, entries }: { month: string; entries: ArchiveEntry[] }) {
  const sample = entries[0].spec;
  const p = sample.photos.find((p) => p.role === 'key') ?? sample.photos[0];
  const variant = Number(month.slice(-2)) % 3;
  return (
    <div
      className={'cloth-book cloth-' + variant}
      style={{ viewTransitionName: 'month-' + month } as CSSProperties}
    >
      <span className="cover-seam" />
      <div className="binder-label">
        <small>
          {month.slice(0, 4)} &nbsp; / &nbsp; {month.slice(-2)}
        </small>
        <strong>{monthTitle(month)}</strong>
        <span>{entryCount(entries.length)}</span>
      </div>
      {p && (
        <div className="binder-print">
          <img src={p.src} alt="" />
          <i />
        </div>
      )}
      <span className="book-ribbon" />
    </div>
  );
}
