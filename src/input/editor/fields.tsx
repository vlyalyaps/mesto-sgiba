import { useId, useState } from 'react';
import { fontStyle, typeFonts } from '../../render/sheetStyle';
import type { SheetFont } from '../../types/sheet';
import { ALPHABETS } from './catalog';
import type { Editor } from './context';

const SAMPLE = ['410', '431', '432']; // «Абв»

export function Fonts({
  value,
  cut = true,
  onChange,
}: {
  value?: SheetFont;
  /** Вырезанные буквы бывают только у названия и надписей. */
  cut?: boolean;
  onChange: (font: SheetFont) => void;
}) {
  return (
    <div className="ed-fonts" role="group" aria-label="Шрифты">
      {(Object.keys(typeFonts) as (keyof typeof typeFonts)[]).map((font) => (
        <button
          key={font}
          type="button"
          className="ed-font"
          aria-pressed={value === font}
          onClick={() => onChange(font)}
        >
          <b style={fontStyle(font)}>Абв Где</b>
          <small>{typeFonts[font].title}</small>
        </button>
      ))}
      {cut &&
        ALPHABETS.map(({ id, title }) => (
          <button
            key={id}
            type="button"
            className="ed-font"
            aria-pressed={value === `cut-${id}`}
            onClick={() => onChange(`cut-${id}`)}
          >
            <span className="ed-font-cut" aria-hidden="true">
              {SAMPLE.map((code) => (
                <img
                  key={code}
                  src={`${import.meta.env.BASE_URL}letters/${id}/${code}.webp`}
                  alt=""
                  loading="lazy"
                  draggable={false}
                />
              ))}
            </span>
            <small>{title}</small>
          </button>
        ))}
    </div>
  );
}

const goodName = (name: string) => {
  const words = name.trim().split(/\s+/u).filter(Boolean).length;
  return words === 0 || (words >= 3 && words <= 7);
};

/** Название папки: своё можно, но из 3–7 слов, как у всех дней дневника. */
export function TitleField({ editor }: { editor: Editor }) {
  const id = useId();
  const saved = editor.edits.folderName ?? '';
  const [draft, setDraft] = useState<{ saved: string; value: string }>({ saved, value: saved });
  // Отмена и повтор меняют название снаружи — поле показывает их, а не свой черновик.
  const value = draft.saved === saved ? draft.value : saved;
  const ok = goodName(value);
  return (
    <div className="ed-field">
      <label htmlFor={id}>Название дня</label>
      <input
        id={id}
        className="ed-input"
        value={value}
        maxLength={120}
        placeholder={editor.base.folderName}
        aria-invalid={!ok || undefined}
        onChange={(e) => {
          const next = e.target.value;
          const good = goodName(next);
          const name = next.trim() ? next : '';
          setDraft({ saved: good ? name : saved, value: next });
          if (good) editor.setEdits({ folderName: name || undefined }, 'folder-name');
        }}
      />
      {!ok && <p className="ed-error">Название папки — от 3 до 7 слов.</p>}
    </div>
  );
}
