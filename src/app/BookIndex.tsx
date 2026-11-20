import type { MouseEvent } from 'react';
import { BookLeaf } from '../render/BookBinding';
import { formatDate } from '../render/format';
import { CollageSticker } from '../render/stickers/CollageSticker';
import { Sticker, moodLabel } from '../render/stickers/Sticker';
import type { DaySpec } from '../types/dayspec';
import { routeHref } from './router';

export function BookIndex({
  days,
  title,
  onTurn,
}: {
  days: DaySpec[];
  title: string;
  onTurn: (id: string) => void;
}) {
  const photos = [...new Set(days.flatMap((day) => day.photos.map((photo) => photo.src)))].slice(
    0,
    3,
  );
  function open(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    event.preventDefault();
    onTurn(id);
  }
  return (
    <>
      <BookLeaf
        side="left"
        label="Внутренняя сторона обложки"
        stock="aged"
        className="front-pastedown"
      >
        <div className="pastedown-art" aria-hidden="true">
          <div className="ownership-label">
            <span>Место сгиба</span>
            <strong>{title}</strong>
          </div>
          {photos.map((src, i) => (
            <figure key={src} className={`pastedown-print pastedown-print-${i}`}>
              <img src={src} alt="" />
              <i className="washi" />
            </figure>
          ))}
          <div className="pastedown-mark">
            <CollageSticker motif="postmark" date={days[0].date} />
          </div>
        </div>
      </BookLeaf>
      <BookLeaf side="right" label="Оглавление" stock="cream" className="book-index">
        <h2>Оглавление</h2>
        <ol className="index-days">
          {days.map((spec) => {
            const photo = spec.photos.find((p) => p.role === 'key') ?? spec.photos[0];
            const mood = spec.page.elements.find((e) => e.kind === 'mood');
            return (
              <li key={spec.id}>
                <a
                  href={routeHref({ name: 'day', id: spec.id })}
                  onClick={(event) => open(event, spec.id)}
                >
                  {photo && <img className="index-thumbnail" src={photo.src} alt="" />}
                  <span className="index-caption">
                    <time dateTime={spec.date}>{formatDate(spec.date)}</time>
                    <strong>{spec.folderName}</strong>
                  </span>
                  {mood && (
                    <span className="toc-face" title={moodLabel(mood.mood)}>
                      <Sticker motif={mood.mood} label="настроение" />
                    </span>
                  )}
                  <span className="index-arrow" aria-hidden="true">
                    →
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </BookLeaf>
    </>
  );
}
