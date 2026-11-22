import type { CSSProperties } from 'react';
import { bindingClass } from '../render/BookBinding';
import { Scan } from '../render/Scrap';
import type { ArchiveEntry } from './days';
import { entryCount, monthTitle } from './months';
import './shelf.css';

export function MonthCover({ month, entries }: { month: string; entries: ArchiveEntry[] }) {
  const days = entries.map((entry) => entry.spec);
  const newest = [...days].sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number)[0];
  const photo = newest.photos.find((p) => p.role === 'key') ?? newest.photos[0];
  const has = (motif: string) =>
    days.some((day) => day.page.elements.some((e) => e.kind === 'sticker' && e.motif === motif));
  const averageDensity = days.reduce((sum, day) => sum + day.rhythm.density, 0) / days.length;
  const worn = Math.min(
    0.8,
    0.22 +
      days.length * 0.06 +
      (days.reduce((sum, day) => sum + day.paper.age, 0) / days.length) * 0.25,
  );
  const sticker = has('rail-ticket') ? 'rail-ticket' : has('paper-film') ? 'pin' : 'punch-stamp';
  return (
    <div
      className={`composition-book ${bindingClass(month)}`}
      style={
        {
          viewTransitionName: 'month-' + month,
          '--label-stock': averageDensity > 0.61 ? '#e6cc94' : '#b9c6b0',
          '--wear': worn,
        } as CSSProperties
      }
    >
      <span className="composition-spine" aria-hidden="true" />
      <div className="binder-label">
        <small>Место сгиба</small>
        <strong>{monthTitle(month)}</strong>
        <span>
          {month.slice(0, 4)} · {entryCount(entries.length)}
        </span>
      </div>
      {photo && (
        <figure className="binder-print">
          <img src={photo.src} alt="" />
          <i>
            <Scan name={has('black-tape') ? 'black-tape' : 'masking'} />
          </i>
        </figure>
      )}
      <i className={`cover-keepsake cover-${sticker}`} aria-hidden="true">
        <Scan name={sticker} />
        {sticker === 'rail-ticket' && <span>В ДОРОГЕ</span>}
      </i>
      {has('receipt') && (
        <i className="cover-pencil" aria-hidden="true">
          <Scan name="punch-stamp" />
        </i>
      )}
      <i className="cover-wear" aria-hidden="true" />
    </div>
  );
}
