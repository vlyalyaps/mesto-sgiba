import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { analyzePreview } from '../audio/analyze';
import { refreshPreview } from '../audio/itunes';
import { moodLabel, Sticker } from '../render/stickers/Sticker';
import type { DayInput, Mood, PhotoInput, SongInput } from '../types/dayspec';
import { getDayWeather, places } from '../weather';
import '@fontsource/neucha/cyrillic-400.css';
import './dayForm.css';
import { PhotoPicker } from './PhotoPicker';
import { SongPicker, type SongChoice } from './SongPicker';
import { usePhotos } from './usePhotos';

export interface DayFormProps {
  /** Номер нового дня в архиве. */
  nextNumber: number;
  /**
   * Готовый день: DayInput (у своих фото src пустой) и сами фото по PhotoInput.id.
   * Дальше приложение сохраняет день и открывает книжку.
   */
  onDone(input: DayInput, photos: Record<string, Blob>): void;
  onCancel(): void;
}

const MOODS: Mood[] = ['calm', 'joyful', 'tired', 'restless', 'wistful', 'curious', 'proud'];
const AUDIO_TIMEOUT_MS = 20_000;

type PlaceKey = keyof typeof places;

interface Errors {
  date?: string;
  text?: string;
  photos?: string;
  song?: string;
}

function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Разбор фрагмента песни; любая неудача — null, день складывается без признаков звука. */
async function listen(song: SongInput, signal: AbortSignal) {
  try {
    const url =
      song.previewUrl ?? (song.trackId ? await refreshPreview(song.trackId, signal) : null);
    if (!url) return null;
    const limit = AbortSignal.timeout(AUDIO_TIMEOUT_MS);
    return await analyzePreview(url, AbortSignal.any([signal, limit]));
  } catch {
    signal.throwIfAborted();
    return null;
  }
}

/** Экран «Записать день»: текст, 1–5 фото, настроение, песня, погода. */
export function DayForm({ nextNumber, onDone, onCancel }: DayFormProps) {
  const ids = useId();
  const [date, setDate] = useState(today);
  const [text, setText] = useState('');
  const [mood, setMood] = useState<Mood | undefined>();
  const [choice, setChoice] = useState<SongChoice>({ song: null, skipped: false });
  const [withWeather, setWithWeather] = useState(true);
  const [place, setPlace] = useState<PlaceKey>('taldykorgan');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [failure, setFailure] = useState('');

  const photos = usePhotos();
  const busyRef = useRef(false);
  const ctlRef = useRef<AbortController | null>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const songRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => ctlRef.current?.abort(), []);

  const validate = (): Errors => {
    const e: Errors = {};
    if (!date) e.date = 'Укажите дату дня.';
    if (!text.trim()) e.text = 'Напишите хотя бы пару строк о дне.';
    if (photos.items.some((p) => p.status === 'loading')) {
      e.photos = 'Фото ещё готовятся, подождите секунду.';
    } else if (!photos.items.length) {
      e.photos = 'Добавьте хотя бы одно фото.';
    }
    if (!choice.song && !choice.skipped) {
      e.song = 'Выберите песню или нажмите «Сохранить без песни».';
    }
    return e;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (busyRef.current) return;
    const found = validate();
    setErrors(found);
    setFailure('');
    if (found.date) return dateRef.current?.focus();
    if (found.text) return textRef.current?.focus();
    if (found.photos) return fileRef.current?.focus();
    if (found.song) return songRef.current?.focus();

    busyRef.current = true;
    setBusy(true);
    const ctl = new AbortController();
    ctlRef.current = ctl;
    try {
      let song = choice.song;
      if (song) {
        setStatus('Слушаю песню…');
        song = { ...song, features: await listen(song, ctl.signal) };
      }

      let weather: Awaited<ReturnType<typeof getDayWeather>>;
      const first = photos.items[0].prepared;
      if (withWeather) {
        setStatus('Смотрю погоду…');
        const recordedAt = date === today() ? new Date().toISOString() : `${date}T12:00:00`;
        weather = await getDayWeather({
          enabled: true,
          takenAt: first?.takenAt,
          recordedAt,
          place,
          signal: ctl.signal,
        }).catch(() => {
          ctl.signal.throwIfAborted();
          return undefined;
        });
      }

      setStatus('Складываю страницы…');
      const blobs: Record<string, Blob> = {};
      const list: PhotoInput[] = [];
      for (const item of photos.items) {
        const p = item.prepared;
        if (!p) continue;
        blobs[item.id] = p.blob;
        list.push({
          id: item.id,
          src: '',
          width: p.width,
          height: p.height,
          palette: p.palette,
          lightness: p.lightness,
          ...(item.focus ? { focus: item.focus } : {}),
        });
      }
      const input: DayInput = {
        date,
        number: nextNumber,
        text: text.trim(),
        photos: list,
        song,
        ...(mood ? { mood } : {}),
        ...(weather ? { weather } : {}),
        ...(first?.takenAt ? { takenAt: first.takenAt } : {}),
      };
      onDone(input, blobs);
    } catch {
      if (ctl.signal.aborted) return;
      setFailure('Не получилось сложить день. Проверьте сеть и нажмите кнопку ещё раз.');
      setStatus('');
      busyRef.current = false;
      setBusy(false);
    }
  };

  const cancel = () => {
    ctlRef.current?.abort();
    onCancel();
  };

  // Enter в полях не отправляет форму: отправка только кнопкой.
  const noEnterSubmit = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault();
  };

  // Ошибка у поля уходит, как только человек её исправил.
  const shown: Errors = {
    date: date ? undefined : errors.date,
    text: text.trim() ? undefined : errors.text,
    photos:
      photos.items.length && photos.items.every((p) => p.status === 'ready')
        ? undefined
        : errors.photos,
    song: choice.song || choice.skipped ? undefined : errors.song,
  };

  return (
    <form className="df" onSubmit={(e) => void submit(e)} onKeyDown={noEnterSubmit} noValidate>
      <header className="df-head">
        <p className="df-kicker">День № {nextNumber}</p>
        <h1>Записать день</h1>
        <p className="df-lede">Текст, фото и песня. Остальное сложится само.</p>
      </header>

      <fieldset className="df-fields" disabled={busy} aria-busy={busy}>
        <div className="df-field df-date">
          <label className="df-label" htmlFor={ids + 'date'}>
            Дата
          </label>
          <input
            ref={dateRef}
            id={ids + 'date'}
            className="df-input"
            type="date"
            value={date}
            max={today()}
            required
            aria-invalid={shown.date ? true : undefined}
            aria-describedby={shown.date ? ids + 'date-err' : undefined}
            onChange={(e) => setDate(e.target.value)}
          />
          {shown.date && (
            <p className="df-error" role="alert" id={ids + 'date-err'}>
              {shown.date}
            </p>
          )}
        </div>

        <div className="df-field">
          <label className="df-label" htmlFor={ids + 'text'}>
            Как прошёл день
          </label>
          <textarea
            ref={textRef}
            id={ids + 'text'}
            className="df-text"
            rows={7}
            value={text}
            placeholder="Расскажите, как другу: какая была погода, свет, звуки, кто был рядом."
            aria-invalid={shown.text ? true : undefined}
            aria-describedby={shown.text ? ids + 'text-err' : undefined}
            onChange={(e) => setText(e.target.value)}
          />
          {shown.text && (
            <p className="df-error" role="alert" id={ids + 'text-err'}>
              {shown.text}
            </p>
          )}
        </div>

        <PhotoPicker photos={photos} error={shown.photos} inputRef={fileRef} />

        <div className="df-field">
          <span className="df-label" id={ids + 'mood'}>
            Настроение <small>по желанию</small>
          </span>
          <div className="df-moods" role="group" aria-labelledby={ids + 'mood'}>
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                className="df-mood"
                aria-pressed={mood === m}
                onClick={() => setMood(mood === m ? undefined : m)}
              >
                <Sticker motif={m} />
                <span>{moodLabel(m)}</span>
              </button>
            ))}
          </div>
        </div>

        <SongPicker value={choice} onChange={setChoice} error={shown.song} inputRef={songRef} />

        <div className="df-field">
          <label className="df-check">
            <input
              type="checkbox"
              checked={withWeather}
              onChange={(e) => setWithWeather(e.target.checked)}
            />
            <span>Добавить погоду</span>
          </label>
          <p className="df-hint">
            В сервис Open-Meteo уйдёт только город и час: без текста и фото. Без согласия погоды в
            дне не будет.
          </p>
          {withWeather && (
            <div className="df-places" role="radiogroup" aria-label="Где был этот день">
              {(Object.keys(places) as PlaceKey[]).map((k) => (
                <label key={k} className="df-place">
                  <input
                    type="radio"
                    name={ids + 'place'}
                    checked={place === k}
                    onChange={() => setPlace(k)}
                  />
                  <span>{places[k].name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </fieldset>

      <div className="df-actions">
        <button type="submit" className="ink-button df-submit" disabled={busy} aria-busy={busy}>
          Сложить день
        </button>
        <button type="button" className="df-link" onClick={cancel}>
          Назад к полке
        </button>
      </div>
      <p className="df-status" role="status">
        {status}
      </p>
      {failure && (
        <p className="df-error" role="alert">
          {failure}
        </p>
      )}
    </form>
  );
}
