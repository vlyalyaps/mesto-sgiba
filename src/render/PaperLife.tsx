import { useId, useState } from 'react';
import type { DaySpec } from '../types/dayspec';
import { formatDate } from './format';

export function LifeScan({ name }: { name: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}scraps/life/${name}.webp`}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}

export function Pocket({
  open,
  onToggle,
  preview,
}: {
  open: boolean;
  onToggle: () => void;
  preview: boolean;
}) {
  const art = (
    <>
      <LifeScan name="pocket" />
      <span className="pocket-ink">
        {open ? 'убрать снимки' : 'снимки'} <i>{open ? '↓' : '↑'}</i>
      </span>
    </>
  );
  return preview ? (
    <div className="pocket-button">{art}</div>
  ) : (
    <button
      type="button"
      className="pocket-button"
      aria-expanded={open}
      aria-label={open ? 'Убрать снимки в кармашек' : 'Выдвинуть снимки из кармашка'}
      onClick={onToggle}
    >
      {art}
    </button>
  );
}

function PaperNote({
  kind,
  spec,
  preview,
}: {
  kind: 'folded' | 'sticky';
  spec: DaySpec;
  preview: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const fold = kind === 'folded';
  const label = fold
    ? open
      ? 'Сложить записку'
      : 'Развернуть записку'
    : open
      ? 'Опустить стикер'
      : 'Отогнуть стикер';
  const face = (
    <>
      <LifeScan name={kind} />
      <span>
        {fold ? 'на память' : 'на полях'} <i>{fold ? '⌄' : '↗'}</i>
      </span>
    </>
  );
  return (
    <div className={`note-wrap note-${kind}`} data-open={open}>
      {preview ? (
        <div className="note-toggle">{face}</div>
      ) : (
        <button
          type="button"
          className="note-toggle"
          aria-expanded={open}
          aria-label={label}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          {face}
        </button>
      )}
      <div className="note-inside" id={id} inert={!open}>
        <span>{fold ? spec.key.text : (spec.folds[0]?.text ?? spec.key.text)}</span>
      </div>
    </div>
  );
}

export function PaperTrace({
  motif,
  spec,
  preview,
}: {
  motif: string;
  spec: DaySpec;
  preview: boolean;
}) {
  if (motif === 'reverse-ink') {
    const lines = [...spec.folds.slice(0, 2).map((f) => f.text), spec.key.text];
    return (
      <div className="reverse-ink" aria-hidden="true">
        {lines.map((line, i) => (
          <span key={i}>{line}</span>
        ))}
        <i>{lines[0]}</i>
      </div>
    );
  }
  if (motif === 'bent-corner') return <span className="bent-corner" aria-hidden="true" />;
  const name = motif.slice(5);
  if (name === 'folded' || name === 'sticky')
    return <PaperNote kind={name} spec={spec} preview={preview} />;
  if (name === 'date-stamp')
    return (
      <time dateTime={spec.date} className="life-date-stamp">
        {formatDate(spec.date)}
      </time>
    );
  if (name === 'bridge')
    return (
      <div className="life-bridge">
        <LifeScan name="paper-label" />
        <span>снимки</span>
      </div>
    );
  if (name === 'photo-arrow')
    return (
      <span className="life-photo-arrow" aria-hidden="true">
        ↜
      </span>
    );
  if (name === 'label-digital')
    return (
      <span className="life-digital-label">
        {spec.song?.year}
        <b>♫</b>
      </span>
    );
  return (
    <div className="paper-trace" aria-hidden="true">
      <LifeScan name={name} />
    </div>
  );
}
