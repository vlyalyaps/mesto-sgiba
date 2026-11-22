import { useId, type MouseEvent } from 'react';
import { moodLabel, Sticker } from '../../render/stickers/Sticker';
import type { Mood } from '../../types/dayspec';
import { places } from '../../weather';
import { SongPicker } from '../SongPicker';
import { MAX_PHOTOS, type PhotoItem } from '../usePhotos';
import { CARRIERS } from './catalog';
import type { Editor, PlaceKey } from './context';
import { Chips } from './controls';
import { clamp } from './model';
import { photoCutout } from './names';

const MOODS: Mood[] = ['calm', 'joyful', 'tired', 'restless', 'wistful', 'curious', 'proud'];
const round = (v: number) => Math.round(clamp(v, 0, 1) * 100) / 100;

/** Первая вкладка: вся запись — текст, фото, песня, настроение, дата и погода. */
export function DayPanel({ editor }: { editor: Editor }) {
  const id = useId();
  const { errors, weather } = editor;
  return (
    <>
      <div className="ed-day-head">
        <p>День № {editor.number}</p>
        <label>
          <span className="ed-hidden">Дата</span>
          <input
            className="ed-input"
            type="date"
            data-field="date"
            value={editor.date}
            max={editor.lastDate}
            disabled={editor.saved}
            required
            aria-label="Дата"
            aria-invalid={errors.date ? true : undefined}
            aria-describedby={errors.date ? `${id}date-err` : undefined}
            onChange={(e) => editor.onDate(e.target.value)}
          />
        </label>
      </div>
      {errors.date && (
        <p className="ed-error" role="alert" id={`${id}date-err`}>
          {errors.date}
        </p>
      )}

      <div className="ed-day-part">
        <label className="ed-day-label" htmlFor={`${id}text`}>
          Как прошёл день
        </label>
        <textarea
          id={`${id}text`}
          className="ed-input ed-entry"
          data-field="text"
          rows={5}
          value={editor.text}
          placeholder="Расскажите, как другу: какая была погода, свет, звуки, кто был рядом."
          aria-invalid={errors.text ? true : undefined}
          aria-describedby={errors.text ? `${id}text-err` : undefined}
          onChange={(e) => editor.onText(e.target.value)}
        />
        {errors.text && (
          <p className="ed-error" role="alert" id={`${id}text-err`}>
            {errors.text}
          </p>
        )}
      </div>

      <Photos editor={editor} />
      <Song editor={editor} />

      <div className="ed-day-part">
        <span className="ed-day-label" id={`${id}mood`}>
          Настроение <small>по желанию</small>
        </span>
        <div className="ed-moods" role="group" aria-labelledby={`${id}mood`}>
          {MOODS.map((mood) => (
            <button
              key={mood}
              type="button"
              className="ed-mood"
              aria-pressed={editor.mood === mood}
              onClick={() => editor.onMood(editor.mood === mood ? undefined : mood)}
            >
              <Sticker motif={mood} />
              <span>{moodLabel(mood)}</span>
            </button>
          ))}
        </div>
      </div>

      {weather && (
        <div className="ed-day-part">
          <label className="ed-check">
            <input
              type="checkbox"
              checked={weather.on}
              onChange={(e) => weather.onToggle(e.target.checked)}
            />
            <span>Добавить погоду</span>
          </label>
          {weather.on && (
            <div className="ed-places" role="radiogroup" aria-label="Где был этот день">
              {(Object.keys(places) as PlaceKey[]).map((place) => (
                <label key={place} className="ed-check">
                  <input
                    type="radio"
                    name={`${id}place`}
                    checked={weather.place === place}
                    onChange={() => weather.onPlace(place)}
                  />
                  <span>{places[place].name}</span>
                </label>
              ))}
            </div>
          )}
          <p className="ed-note">
            В сервис Open-Meteo уйдёт только город и час: без текста и фото. Без согласия погоды в
            дне не будет.
          </p>
        </div>
      )}
    </>
  );
}

function Photos({ editor }: { editor: Editor }) {
  const { photos, spec, errors } = editor;
  const { items, problems } = photos;
  const id = useId();

  const mark = (photo: PhotoItem, e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    // Касание клавишей приходит без координат: тогда отмечаем середину кадра.
    const keyboard = e.detail === 0 && e.clientX === 0 && e.clientY === 0;
    photos.setFocus(
      photo.id,
      keyboard
        ? { x: 0.5, y: 0.5 }
        : { x: round((e.clientX - r.left) / r.width), y: round((e.clientY - r.top) / r.height) },
    );
  };

  return (
    <div className="ed-day-part" aria-busy={items.some((p) => p.status === 'loading')}>
      <span className="ed-day-label" id={`${id}label`}>
        Фото <small>от 1 до {MAX_PHOTOS}</small>
      </span>
      <div className="ed-photos" role="group" aria-labelledby={`${id}label`}>
        {items.map((photo, i) => {
          if (photo.status === 'loading' || !photo.prepared)
            return (
              <span key={photo.id} className="skeleton ed-photo-wait" aria-label="Фото готовится" />
            );
          const hero = spec.photos.some((p) => p.photoId === photo.id && p.role === 'key');
          return (
            <figure key={photo.id} className="ed-photo">
              <button
                type="button"
                className="ed-photo-pick"
                draggable
                style={{ aspectRatio: `${photo.prepared.width} / ${photo.prepared.height}` }}
                aria-label={`Фото ${i + 1}: отметить главное место. ${
                  photo.focus ? 'Отметка стоит.' : 'Отметки нет.'
                }`}
                onDragStart={(e) => e.dataTransfer.setData('text/plain', `photo:${photo.id}`)}
                onClick={(e) => mark(photo, e)}
              >
                <img src={photo.url} alt="" draggable={false} />
                {photo.focus && (
                  <i
                    className="ed-focus"
                    style={{ left: `${photo.focus.x * 100}%`, top: `${photo.focus.y * 100}%` }}
                  />
                )}
              </button>
              <figcaption>
                <button
                  type="button"
                  className="ed-mini"
                  aria-label={`Положить на лист фото ${i + 1}`}
                  title="Положить на лист"
                  onClick={() => {
                    const cut = photoCutout(editor, photo.id);
                    if (cut) editor.add(cut);
                  }}
                >
                  +
                </button>
                <button
                  type="button"
                  className="ed-mini"
                  aria-pressed={hero}
                  aria-label={`Главный кадр: фото ${i + 1}`}
                  title="Главный кадр"
                  onClick={() => editor.setEdits({ keyPhotoId: photo.id })}
                >
                  ★
                </button>
                <button
                  type="button"
                  className="ed-mini"
                  aria-label={`Убрать фото ${i + 1}`}
                  title="Убрать из дня"
                  onClick={() => photos.remove(photo.id)}
                >
                  ×
                </button>
              </figcaption>
            </figure>
          );
        })}
        {items.length < MAX_PHOTOS && (
          <button
            type="button"
            className="ed-upload"
            data-field="photos"
            data-first={!items.length || undefined}
            aria-describedby={errors.photos ? `${id}err` : undefined}
            onClick={editor.pickPhotos}
          >
            <b aria-hidden="true">+</b>
            <span>{items.length ? 'Ещё фото' : 'Добавить фото'}</span>
          </button>
        )}
      </div>
      {items.some((p) => p.status === 'ready') && (
        <p className="ed-note">Коснитесь фото, чтобы отметить главное место кадра.</p>
      )}
      {problems.map((problem) => (
        <p key={problem.key} className="ed-error ed-problem" role="alert">
          <span>
            {problem.name && <b>{problem.name}: </b>}
            {problem.message}
          </span>
          <button
            type="button"
            onClick={() => photos.dismissProblem(problem.key)}
            aria-label="Скрыть сообщение"
          >
            ×
          </button>
        </p>
      ))}
      {errors.photos && (
        <p className="ed-error" role="alert" id={`${id}err`}>
          {errors.photos}
        </p>
      )}
    </div>
  );
}

function Song({ editor }: { editor: Editor }) {
  const song = editor.choice.song;
  const tickets = editor.items.filter((item) => item.kind === 'ticket');
  const shown = editor.spec.page.elements.find((e) => e.kind === 'ticket');
  return (
    <div className="ed-day-part ed-song" data-field="song">
      <SongPicker
        value={editor.choice}
        onChange={editor.onChoice}
        error={editor.errors.song}
        inputRef={null}
      />
      {song && (
        <>
          <Chips
            label="Носитель песни"
            options={CARRIERS}
            value={shown?.kind === 'ticket' ? shown.carrier : undefined}
            onChange={(carrier) => {
              if (!tickets.length)
                return editor.add({
                  key: 'ticket',
                  title: 'Песня',
                  content: { kind: 'ticket', carrier },
                  w: 0.6,
                  ratio: 2.6,
                  layer: 4,
                });
              editor.update(
                tickets.map((item) => item.id),
                (item) => (item.kind === 'ticket' ? { ...item, carrier } : item),
              );
            }}
          />
          <div className="ed-song-play">
            {(song.trackId || song.previewUrl) && (
              <button type="button" className="ed-chip" onClick={editor.play}>
                ▶ Послушать с листом
              </button>
            )}
            {song.trackViewUrl && (
              <a className="ed-source" href={song.trackViewUrl} target="_blank" rel="noreferrer">
                Apple Music ↗ provided courtesy of iTunes
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
