import type { MouseEvent } from 'react';
import type { PhotoItem } from './usePhotos';
import { MAX_PHOTOS, type usePhotos } from './usePhotos';

const clamp = (n: number) => Math.min(1, Math.max(0, Math.round(n * 100) / 100));

interface Props {
  photos: ReturnType<typeof usePhotos>;
  error?: string;
  inputRef: React.Ref<HTMLInputElement>;
}

export function PhotoPicker({ photos, error, inputRef }: Props) {
  const { items, problems } = photos;
  const full = items.length >= MAX_PHOTOS;

  const place = (item: PhotoItem, e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    // Касание клавишей приходит без координат: тогда отмечаем середину кадра.
    const keyboard = e.detail === 0 && e.clientX === 0 && e.clientY === 0;
    photos.setFocus(
      item.id,
      keyboard
        ? { x: 0.5, y: 0.5 }
        : { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) },
    );
  };

  return (
    <div className="df-field">
      <span className="df-label" id="df-photos-label">
        Фото <small>от 1 до {MAX_PHOTOS}</small>
      </span>
      <ul className="df-photos" aria-labelledby="df-photos-label" aria-busy={items.some(isLoading)}>
        {items.map((item, i) =>
          item.status === 'loading' || !item.prepared ? (
            <li key={item.id} className="df-photo df-photo-wait" aria-label="Фото готовится">
              <span className="skeleton df-photo-skeleton" aria-hidden="true" />
            </li>
          ) : (
            <li key={item.id} className="df-photo">
              <button
                type="button"
                className="df-photo-tap"
                style={{ aspectRatio: `${item.prepared.width} / ${item.prepared.height}` }}
                onClick={(e) => place(item, e)}
                aria-label={`Фото ${i + 1}: отметить главное место. ${
                  item.focus ? 'Отметка стоит.' : 'Отметки нет.'
                }`}
              >
                <img src={item.url} alt="" draggable={false} />
                {item.focus && (
                  <span
                    className="df-focus"
                    style={{ left: `${item.focus.x * 100}%`, top: `${item.focus.y * 100}%` }}
                    aria-hidden="true"
                  />
                )}
              </button>
              <button
                type="button"
                className="df-photo-remove"
                onClick={() => photos.remove(item.id)}
                aria-label={`Убрать фото ${i + 1}`}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ),
        )}
        {!full && (
          <li className="df-photo df-photo-add">
            <label className="df-add">
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  photos.add(Array.from(e.target.files ?? []));
                  e.target.value = '';
                }}
              />
              <span aria-hidden="true" className="df-add-plus">
                +
              </span>
              <span>{items.length ? 'Ещё фото' : 'Добавить фото'}</span>
            </label>
          </li>
        )}
      </ul>
      {items.some((p) => p.status === 'ready') && (
        <p className="df-hint">Коснитесь фото, чтобы отметить главное место кадра.</p>
      )}
      {problems.map((p) => (
        <p key={p.key} className="df-error" role="alert">
          <span>
            {p.name ? <b>{p.name}: </b> : null}
            {p.message}
          </span>
          <button
            type="button"
            className="df-dismiss"
            onClick={() => photos.dismissProblem(p.key)}
            aria-label="Скрыть сообщение"
          >
            ×
          </button>
        </p>
      ))}
      {error && (
        <p className="df-error" role="alert" id="df-photos-error">
          {error}
        </p>
      )}
    </div>
  );
}

function isLoading(p: PhotoItem) {
  return p.status === 'loading';
}
