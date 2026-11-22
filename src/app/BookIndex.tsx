import type { MouseEvent } from 'react';
import { BookLeaf } from '../render/BookBinding';
import { formatDate } from '../render/format';
import { Scan, Spiral } from '../render/Scrap';
import { moodLabel } from '../render/stickers/Sticker';
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
              <i>
                <Scan name={i === 1 ? 'black-tape' : 'masking'} />
              </i>
            </figure>
          ))}
          <div className="pastedown-mark">
            <Scan name="punch-stamp" />
          </div>
        </div>
        <Spiral side="left" />
      </BookLeaf>
      <BookLeaf
        side="right"
        label="Оглавление"
        stock="white"
        className="book-index diary-leaf diary-ruled"
      >
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
                  {photo && (
                    <img
                      className={`index-thumbnail index-print-${spec.mode}`}
                      src={photo.src}
                      alt=""
                      style={{
                        objectPosition: `${(photo.crop.x + photo.crop.w / 2) * 100}% ${(photo.crop.y + photo.crop.h / 2) * 100}%`,
                      }}
                    />
                  )}
                  <span className="index-caption">
                    <time dateTime={spec.date}>{formatDate(spec.date)}</time>
                    <strong>{spec.folderName}</strong>
                  </span>
                  {mood && <span className="index-mood">{moodLabel(mood.mood)}</span>}
                  <span className="index-arrow" aria-hidden="true">
                    →
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
        <Spiral side="right" />
      </BookLeaf>
    </>
  );
}
