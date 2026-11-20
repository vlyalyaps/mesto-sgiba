import type { CSSProperties } from 'react';
import type { DaySpec } from '../types/dayspec';
import { formatDate } from './format';
import { focusRegion } from './geometry';
import { readableInk, toneColor } from './paper';
import { Photo, type PhotoLook } from './Photo';
import './book.css';

export function photoLook(spec: DaySpec): PhotoLook {
  return { mode: spec.mode, duo: spec.duo, grain: spec.paper.grain };
}

/** Переменные бумаги для обложки и листов: цвета и сила зерна и старения. */
export function paperVars(spec: DaySpec, tone = spec.paper.tone): CSSProperties {
  const paper = toneColor(tone, spec.paper.brightness, spec.paper.age);
  return {
    '--paper': paper,
    '--ink': readableInk(spec.ink, paper),
    '--grain': (spec.paper.grain * 0.5).toFixed(3),
    '--age': spec.paper.age.toFixed(3),
  } as CSSProperties;
}

const WIN_H = 66;

/**
 * Обложка дня: фрагмент главного кадра, дата, номер и название папки.
 * Заполняет родителя с отношением сторон 4:5 и считает всё в долях своей ширины,
 * поэтому одинаково читается и в архиве, и в закрытой книжке.
 */
export function Cover({ spec }: { spec: DaySpec }) {
  const key = spec.photos.find((p) => p.role === 'key') ?? spec.photos[0];
  const m = 6 + 6 * Math.min(1, Math.max(0, spec.paper.margin));
  const style = { ...paperVars(spec), '--m': `${m}cqw` } as CSSProperties;
  const region = key ? key.crop : focusRegion(0.5, 0.5);
  return (
    <figure className="cover" style={style}>
      <div className="cover-win">
        {key && (
          <Photo
            src={key.src}
            look={photoLook(spec)}
            region={region}
            aspect={(100 - 2 * m) / WIN_H}
          />
        )}
      </div>
      <figcaption className="cover-cap">
        <span className="cover-row">
          <span className="cover-date">{formatDate(spec.date)}</span>
          <span className="cover-no">№ {String(spec.number).padStart(3, '0')}</span>
        </span>
        <span className="cover-title">{spec.folderName}</span>
      </figcaption>
      <span className="tx-grain" aria-hidden="true" />
      <span className="tx-age" aria-hidden="true" />
      <span className="cover-spine" aria-hidden="true" />
      <span className="cover-shape" aria-hidden="true">
        {dayShape(spec).map((s, i) => (
          <span key={i} className={s.key ? 'cs cs-key' : 'cs'} style={{ flexGrow: s.w }} />
        ))}
      </span>
    </figure>
  );
}

/**
 * Форма дня: складки и разворот в том порядке, в каком прошёл день. На обложке это полоса
 * у нижнего края, и в архиве видно, какой день был рваным, а какой ровным, ещё до раскрытия.
 */
export function dayShape(spec: DaySpec): { w: number; key: boolean }[] {
  const fold = (f: DaySpec['folds'][number]) => ({ w: Math.max(0.06, f.width), key: false });
  return [
    ...spec.folds.filter((f) => f.side === 'before').map(fold),
    { w: 0.5, key: true },
    ...spec.folds.filter((f) => f.side === 'after').map(fold),
  ];
}
