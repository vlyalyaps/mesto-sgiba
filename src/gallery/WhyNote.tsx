import { useRef } from 'react';
import { usesFreepik } from '../render/assets';
import type { DaySpec } from '../types/dayspec';
import { weatherWord } from '../weather/words';

/** Главное сразу: слова записи, название, режим снимков, настроение и песня. */
const MAIN = ['page.author', 'key', 'folderName', 'mode', 'page.mood', 'page.carrier'];

/** «Почему так» поверх дня, под маленьким вопросиком. */
export function WhyNote({ spec }: { spec: DaySpec }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const main = spec.why
    .filter((w) => MAIN.includes(w.param))
    .sort((a, b) => Number(b.param === 'page.author') - Number(a.param === 'page.author'));
  // Остальные причины страницы свёрнуты; служебные параметры правил не показываем.
  const rest = spec.why.filter((w) => w.param.startsWith('page.') && !MAIN.includes(w.param));
  const close = () => dialog.current?.close();
  const weather = spec.page.elements.find((e) => e.kind === 'weather')?.weather;
  return (
    <>
      <button
        type="button"
        className="g-ask"
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
        aria-label="Почему так"
        title="Почему так"
      >
        <span aria-hidden="true">?</span>
      </button>
      <dialog
        className="g-why"
        ref={dialog}
        aria-label="Почему так"
        onClick={(e) => {
          // Попали в сам dialog, а не в его содержимое, — значит, нажали мимо окошка.
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="g-why-body">
          <header>
            <h2>Почему так</h2>
            <button type="button" className="g-why-close" onClick={close} aria-label="Закрыть">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="m5 5 10 10M15 5 5 15" />
              </svg>
            </button>
          </header>
          <ul>
            {main.map((w, i) => (
              <li key={i}>{w.text}</li>
            ))}
          </ul>
          {rest.length > 0 && (
            <details key={spec.id}>
              <summary>Ещё {rest.length}</summary>
              <ul>
                {rest.map((w, i) => (
                  <li key={i}>{w.text}</li>
                ))}
              </ul>
            </details>
          )}
          {weather && (
            <p className="g-why-weather">
              Погода настоящая: {weather.place}, {weather.hour}:00 —{' '}
              {weatherWord(weather.code, weather.hour).toLowerCase()}, {Math.round(weather.tempC)}°.
              Данные{' '}
              <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                Open-Meteo
              </a>{' '}
              (CC BY 4.0) на час записи.
            </p>
          )}
          {usesFreepik(spec) && (
            <a
              className="g-why-source"
              href="https://www.freepik.com"
              target="_blank"
              rel="noreferrer"
            >
              Стикеры: Designed by Freepik ↗
            </a>
          )}
        </div>
      </dialog>
    </>
  );
}
