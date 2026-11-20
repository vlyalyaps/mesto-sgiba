import type { DaySpec } from '../types/dayspec';
import { formatDate } from './format';

/** Обложка дня для архива: читается маленькой и без звука. Временная версия. */
export function Cover({ spec }: { spec: DaySpec }) {
  const key = spec.photos.find((p) => p.role === 'key') ?? spec.photos[0];
  return (
    <figure className="cover">
      {key && <img className="cover-photo" src={key.src} alt="" />}
      <figcaption>
        <span className="cover-date">
          {formatDate(spec.date)} · №{spec.number}
        </span>
        <span className="cover-title">{spec.folderName}</span>
      </figcaption>
    </figure>
  );
}
