import { useEffect, useRef, useState } from 'react';
import { createPlayer, type Player } from '../audio/player';
import { refreshPreview } from '../audio/itunes';
import type { DaySpec } from '../types/dayspec';
import { DaySpread } from './DaySpread';
import { formatDate } from './format';

export function SketchbookDay({ spec }: { spec: DaySpec }) {
  const audio = useRef<Player | null>(null);
  const active = useRef<AbortController | null>(null);
  const [sound, setSound] = useState<'off' | 'loading' | 'playing'>('off');
  const [notice, setNotice] = useState('');
  useEffect(
    () => () => {
      active.current?.abort();
      audio.current?.stop();
    },
    [],
  );
  async function play() {
    active.current?.abort();
    audio.current?.stop();
    setNotice('');
    if (sound !== 'off') {
      setSound('off');
      return;
    }
    const request = new AbortController();
    active.current = request;
    setSound('loading');
    try {
      const url =
        spec.song?.previewUrl ??
        (spec.song?.trackId ? await refreshPreview(spec.song.trackId, request.signal) : null);
      if (request.signal.aborted) return;
      if (!url) throw Error();
      const player = createPlayer();
      audio.current = player;
      const off = player.onEnded(() => {
        setSound('off');
        off();
      });
      request.signal.addEventListener('abort', off, { once: true });
      await player.play(url, 0);
      if (request.signal.aborted) {
        player.stop();
        return;
      }
      setSound('playing');
    } catch {
      if (!request.signal.aborted) {
        setSound('off');
        setNotice('Фрагмент сейчас недоступен.');
      }
    }
  }
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
      </header>
      <DaySpread spec={spec} />
      <p className="rotate-hint">Поверните телефон, чтобы увидеть весь разворот</p>
      <footer className="day-actions">
        {spec.song && (spec.song.trackId || spec.song.previewUrl) && (
          <button className="ink-button" onClick={() => void play()}>
            {sound === 'off'
              ? '▶ Открыть со звуком'
              : sound === 'loading'
                ? 'Отменить загрузку'
                : '■ Остановить звук'}
          </button>
        )}
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
        {notice && <span role="status">{notice}</span>}
      </footer>
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
