import type { ReactNode } from 'react';
import type { DaySpec } from '../types/dayspec';
import { DaySpread } from './DaySpread';
import { formatDate } from './format';
import { useAssembly } from './useAssembly';
import { weatherWord } from '../weather/words';

export function SketchbookDay({
  spec,
  flip,
  assembled,
}: {
  spec: DaySpec;
  flip?: ReactNode;
  assembled: boolean;
}) {
  const show = useAssembly(spec, assembled);
  const weather = spec.page.elements.find((e) => e.kind === 'weather')?.weather;
  return (
    <article className="sketch-day scrapbook-day">
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
      <DaySpread
        spec={spec}
        at={show.at}
        times={show.times}
        flip={flip}
        playback={
          spec.song && (spec.song.trackId || spec.song.previewUrl)
            ? {
                toggle: () => void show.sound(),
                active: show.mode === 'playing' || show.mode === 'loading',
              }
            : undefined
        }
      />
      <p className="rotate-hint">Поверните телефон, чтобы увидеть весь разворот</p>
      <details className="day-why">
        <summary>Почему так</summary>
        <ul>
          {spec.why
            .filter(
              (w) =>
                w.param.startsWith('page.') ||
                ['key', 'folderName'].includes(w.param) ||
                w.param === 'mode',
            )
            .map((w, i) => (
              <li key={i}>{w.text}</li>
            ))}
          {weather && (
            <li>
              Погода настоящая: {weather.place}, {weather.hour}:00 —{' '}
              {weatherWord(weather.code, weather.hour).toLowerCase()}, {Math.round(weather.tempC)}°.
              Данные{' '}
              <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                Open-Meteo
              </a>{' '}
              (CC BY 4.0) на час записи.
            </li>
          )}
        </ul>
      </details>
    </article>
  );
}
