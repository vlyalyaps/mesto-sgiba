import { useEffect, useId, useState } from 'react';
import { lookupSong, parseSongLink, searchSongs } from '../audio/itunes';
import type { SongInput } from '../types/dayspec';

const DELAY_MS = 350;
const ROWS = 5;

type Found =
  | { state: 'idle' }
  | { state: 'busy' }
  | { state: 'done'; songs: SongInput[] }
  | { state: 'error'; message: string };

export interface SongChoice {
  /** Выбранная песня. */
  song: SongInput | null;
  /** Человек явно решил сохранить день без песни. */
  skipped: boolean;
}

interface Props {
  value: SongChoice;
  onChange(next: SongChoice): void;
  error?: string;
  inputRef: React.Ref<HTMLInputElement>;
}

const looksLikeLink = (q: string) => /^https?:\/\//i.test(q) || /apple\.com/i.test(q);
const smallCover = (url: string) => url.replace('600x600bb', '100x100bb');

export function SongPicker({ value, onChange, error, inputRef }: Props) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Found>({ state: 'idle' });
  const listId = useId();
  const hintId = useId();

  // Поиск с задержкой; новый ввод отменяет прошлый запрос.
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const ctl = new AbortController();
    const timer = window.setTimeout(() => {
      setFound({ state: 'busy' });
      const link = looksLikeLink(q);
      const trackId = link ? parseSongLink(q) : null;
      const job: Promise<SongInput[]> = link
        ? trackId === null
          ? Promise.reject(
              new Error(
                'Это не ссылка на песню. Откройте песню в Apple Music и скопируйте ссылку на неё.',
              ),
            )
          : lookupSong(trackId, ctl.signal).then((s) => (s ? [s] : []))
        : searchSongs(q, ctl.signal);
      job.then(
        (songs) => {
          if (!ctl.signal.aborted) setFound({ state: 'done', songs });
        },
        (err: unknown) => {
          if (ctl.signal.aborted) return;
          setFound({
            state: 'error',
            message: err instanceof Error ? err.message : 'Не удалось найти песню.',
          });
        },
      );
    }, DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      ctl.abort();
    };
  }, [query]);

  const empty = !query.trim();
  const shown: Found = empty ? { state: 'idle' } : found;

  if (value.song) {
    const s = value.song;
    return (
      <div className="df-field">
        <span className="df-label">Песня дня</span>
        <div className="df-song df-song-chosen">
          <Cover url={s.artworkUrl} />
          <span className="df-song-text">
            <b>{s.title}</b>
            <span>
              {s.artist}
              {s.year ? `, ${s.year}` : ''}
            </span>
          </span>
          <button
            type="button"
            className="df-link"
            onClick={() => onChange({ song: null, skipped: false })}
          >
            Другая песня
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="df-field">
      <label className="df-label" htmlFor={listId + '-q'}>
        Песня дня
      </label>
      <input
        ref={inputRef}
        id={listId + '-q'}
        className="df-input"
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="Название, исполнитель или ссылка Apple Music"
        value={query}
        disabled={value.skipped}
        aria-describedby={hintId + (error ? ' ' + listId + '-err' : '')}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value.trim()) setFound({ state: 'busy' });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault();
        }}
      />
      <p className="df-hint" id={hintId}>
        Подойдёт название или ссылка на песню из Apple Music. Играет только 30-секундный фрагмент.
      </p>
      <ul
        className="df-songs"
        id={listId}
        aria-busy={shown.state === 'busy'}
        aria-label="Найденные песни"
      >
        {shown.state === 'busy' &&
          Array.from({ length: ROWS }, (_, i) => (
            <li key={i} className="df-song df-song-wait" aria-hidden="true">
              <span className="skeleton df-cover" />
              <span className="df-song-text">
                <span className="skeleton df-line" style={{ width: `${60 - (i % 3) * 8}%` }} />
                <span className="skeleton df-line df-line-short" />
              </span>
            </li>
          ))}
        {shown.state === 'done' &&
          shown.songs.map((s) => (
            <li key={s.trackId}>
              <button
                type="button"
                className="df-song"
                onClick={() => {
                  onChange({ song: s, skipped: false });
                  setQuery('');
                  setFound({ state: 'idle' });
                }}
              >
                <Cover url={s.artworkUrl} />
                <span className="df-song-text">
                  <b>{s.title}</b>
                  <span>
                    {s.artist}
                    {s.year ? `, ${s.year}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
      </ul>
      {shown.state === 'done' && shown.songs.length === 0 && (
        <p className="df-hint" role="status">
          Ничего не нашлось. Попробуйте другое название или сохраните день без песни.
        </p>
      )}
      {shown.state === 'error' && (
        <p className="df-error" role="alert">
          {shown.message}
        </p>
      )}
      <div className="df-skip">
        {value.skipped ? (
          <>
            <span className="df-skip-note">День будет без песни.</span>
            <button
              type="button"
              className="df-link"
              onClick={() => onChange({ song: null, skipped: false })}
            >
              Всё же найти песню
            </button>
          </>
        ) : (
          <button
            type="button"
            className="df-link"
            onClick={() => {
              setQuery('');
              setFound({ state: 'idle' });
              onChange({ song: null, skipped: true });
            }}
          >
            Сохранить без песни
          </button>
        )}
      </div>
      {error && (
        <p className="df-error" role="alert" id={listId + '-err'}>
          {error}
        </p>
      )}
    </div>
  );
}

function Cover({ url }: { url: string | null }) {
  return url ? (
    <img className="df-cover" src={smallCover(url)} alt="" loading="lazy" />
  ) : (
    <span className="df-cover df-cover-none" aria-hidden="true">
      ♪
    </span>
  );
}
