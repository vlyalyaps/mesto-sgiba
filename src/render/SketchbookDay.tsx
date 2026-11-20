import type { DaySpec } from '../types/dayspec';
import { DaySpread } from './DaySpread';
import { formatDate } from './format';
import { useAssembly } from './useAssembly';
export function SketchbookDay({ spec }: { spec: DaySpec }) {
  const show = useAssembly(spec);
  return (
    <article className="sketch-day">
      <header className="entry-heading">
        <div className="folio-meta">
          <time>
            {formatDate(spec.date)} {spec.date.slice(0, 4)}
          </time>
          <span>Лист {String(spec.number).padStart(3, '0')}</span>
        </div>
        <h1>{spec.folderName}</h1>
        <div className="day-actions">
          {spec.song && (spec.song.trackId || spec.song.previewUrl) && (
            <button className="ink-button" onClick={() => void show.sound()}>
              {show.mode === 'loading'
                ? 'Отменить загрузку'
                : show.mode === 'playing'
                  ? '■ Остановить звук'
                  : '▶ Открыть со звуком'}
            </button>
          )}
          <button className="replay" onClick={show.silent}>
            ↻ Собрать без звука
          </button>
          {spec.song?.trackViewUrl && (
            <a
              className="music-credit"
              href={spec.song.trackViewUrl}
              target="_blank"
              rel="noreferrer"
            >
              <b>♫ Apple Music ↗</b>
              <small>provided courtesy of iTunes</small>
            </a>
          )}
          {show.notice && <span role="status">{show.notice}</span>}
        </div>
      </header>
      <DaySpread spec={spec} at={show.at} times={show.times} />
      <p className="rotate-hint">Поверните телефон, чтобы увидеть весь разворот</p>
      <details className="day-why">
        <summary>Почему так</summary>
        <ul>
          {spec.why
            .filter(
              (w) => w.param.startsWith('page.') || ['key', 'mode', 'folderName'].includes(w.param),
            )
            .map((w, i) => (
              <li key={i}>{w.text}</li>
            ))}
        </ul>
      </details>
    </article>
  );
}
