import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BookBinding, BookLeaf } from './BookBinding';
import type { DaySpec, PageElement, PhotoSlot } from '../types/dayspec';
import { isPaperTrace } from '../rules/paperLife';
import { formatDate } from './format';
import { weatherWord } from '../weather/words';
import { moodLabel } from './stickers/Sticker';
import { PrintZoom, type ZoomTarget } from './PrintZoom';
import { MusicKeepsake, Scan, Scrap, Spiral } from './Scrap';
import { PaperTrace, Pocket } from './PaperLife';
import '@fontsource/neucha/cyrillic-400.css';
import '@fontsource/neucha/latin-400.css';
import './sketchbook.css';
import './diary.css';
import './paper-life.css';

type Playback = { toggle: () => void; active: boolean };

function Print({
  photo,
  spec,
  caption,
  onZoom,
  preview,
}: {
  photo: PhotoSlot;
  spec: DaySpec;
  caption?: string;
  onZoom?: (target: ZoomTarget) => void;
  preview?: boolean;
}) {
  const index = spec.photos.indexOf(photo) + 1;
  const content = (
    <>
      <img
        src={photo.src}
        data-print-id={photo.photoId}
        alt=""
        draggable={false}
        loading={photo.role === 'key' ? 'eager' : 'lazy'}
        style={{
          objectPosition: `${(photo.crop.x + photo.crop.w / 2) * 100}% ${(photo.crop.y + photo.crop.h / 2) * 100}%`,
        }}
      />
      {caption && <span>{caption}</span>}
    </>
  );
  return preview ? (
    <div className={`diary-print${caption ? '' : ' print-unmarked'}`}>{content}</div>
  ) : (
    <button
      className={`diary-print${caption ? '' : ' print-unmarked'}`}
      aria-label={`Увеличить снимок ${index}`}
      onClick={(e) => onZoom?.({ photo, button: e.currentTarget })}
    >
      {content}
    </button>
  );
}

/**
 * Запись в дневнике не прокручивается: если текст не помещается в своё место на листе,
 * почерк становится мельче — так пишет человек, когда кончается место.
 */
function useFitText() {
  const box = useRef<HTMLDivElement>(null);
  const ink = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const outer = box.current;
    const inner = ink.current;
    if (!outer || !inner) return;
    const fit = () => {
      let scale = 1;
      const apply = () => {
        inner.style.width = `${100 / scale}%`;
        inner.style.transform = scale === 1 ? '' : `scale(${scale})`;
      };
      apply();
      const room = outer.clientHeight;
      while (room > 0 && inner.offsetHeight * scale > room + 0.5 && scale > 0.62) {
        scale = Math.round((scale - 0.03) * 100) / 100;
        apply();
      }
    };
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(outer);
    void document.fonts?.ready.then(fit);
    return () => watch.disconnect();
  }, []);
  return { box, ink };
}

function EntryText({ sentences, spec }: { sentences: string[]; spec: DaySpec }) {
  const restless = spec.page.elements.some((e) => e.kind === 'sticker' && e.motif === 'crossout');
  const { box, ink } = useFitText();
  return (
    <div className="diary-entry handwriting" ref={box} aria-label="Текст записи">
      <div className="entry-ink" ref={ink}>
        {sentences.map((s, i) => {
          if (i === spec.key.sentence) {
            const at = s.toLowerCase().indexOf(spec.key.text.toLowerCase());
            if (at >= 0)
              return (
                <p key={i}>
                  {s.slice(0, at)}
                  <mark>{s.slice(at, at + spec.key.text.length)}</mark>
                  {s.slice(at + spec.key.text.length)}
                </p>
              );
          }
          return (
            <p key={i}>
              {restless && i === 1 && s.length < 19 ? <span className="ink-circle">{s}</span> : s}
            </p>
          );
        })}
      </div>
    </div>
  );
}

function contents(
  e: PageElement,
  spec: DaySpec,
  onZoom?: (target: ZoomTarget) => void,
  preview = false,
  playback?: Playback,
) {
  switch (e.kind) {
    case 'photo': {
      const photo = spec.photos.find((p) => p.photoId === e.photoId);
      return (
        photo && (
          <Print photo={photo} spec={spec} caption={e.caption} onZoom={onZoom} preview={preview} />
        )
      );
    }
    case 'tape':
      return (
        <Scan
          name={e.color === '#24221e' ? 'black-tape' : e.color === '#57514a' ? 'checks' : 'masking'}
        />
      );
    case 'sticker':
      if (e.motif.startsWith('life-') || isPaperTrace(e.motif))
        return <PaperTrace motif={e.motif} spec={spec} preview={preview} />;
      return <Scrap motif={e.motif} spec={spec} />;
    case 'ticket':
      return playback && !preview ? (
        <button
          type="button"
          className="music-tap"
          onClick={playback.toggle}
          aria-pressed={playback.active}
          aria-label={playback.active ? 'Остановить фрагмент' : 'Включить фрагмент с носителя'}
        >
          <MusicKeepsake spec={spec} carrier={e.carrier ?? 'note'} />
        </button>
      ) : (
        <MusicKeepsake spec={spec} carrier={e.carrier ?? 'note'} />
      );
    case 'date':
      return (
        <time dateTime={spec.date}>
          {formatDate(spec.date)} ’{spec.date.slice(2, 4)}
        </time>
      );
    case 'text':
      return <EntryText sentences={e.sentences} spec={spec} />;
    case 'mood':
      return (
        <>
          <small>настроение</small>
          <span>{moodLabel(e.mood)}</span>
        </>
      );
    case 'weather':
      return (
        <>
          <span>
            {e.weather.code === 0 && e.weather.hour >= 17 ? '☾ ' : ''}
            {Math.round(e.weather.tempC)}° · {e.weather.hour}:00
          </span>
          <small>
            {weatherWord(e.weather.code, e.weather.hour)} · {e.weather.place}
          </small>
        </>
      );
  }
}

export function DayLeaves({
  spec,
  at = Infinity,
  times = [],
  preview = false,
  onZoom,
  playback,
}: {
  spec: DaySpec;
  at?: number;
  times?: number[];
  preview?: boolean;
  onZoom?: (target: ZoomTarget) => void;
  playback?: Playback;
}) {
  const [pocketOpen, setPocketOpen] = useState(false);
  const ruled = spec.page.stock === 'aged' ? 'aged' : 'white';
  const emphasis = spec.page.elements.some((e) => e.kind === 'sticker' && e.motif === 'crossout');
  return (['left', 'right'] as const).map((leaf) => {
    const sheet = spec.page.elements.find(
      (e) => e.leaf === leaf && e.kind === 'sticker' && e.motif.startsWith('sheet-'),
    );
    const paper = sheet?.kind === 'sticker' ? sheet.motif : '';
    const pocket = spec.page.elements.some(
      (e) => e.leaf === leaf && e.kind === 'sticker' && e.motif === 'life-pocket',
    );
    return (
      <BookLeaf
        key={leaf}
        side={leaf}
        marker={spec.page.marker}
        stock={leaf === 'left' ? spec.page.stock : ruled}
        label={leaf === 'left' ? 'Левый лист' : 'Правый лист'}
        className={`diary-leaf diary-${leaf === 'left' ? 'photo-leaf' : 'ruled'} look-${spec.mode} ${paper}${emphasis ? ' diary-restless' : ''}`}
      >
        {spec.page.elements.map((e, i) => {
          if (e.leaf !== leaf) return null;
          const visible =
            at >= (times[i] ?? 0) || (e.kind === 'ticket' && playback?.active === true);
          const motif = e.kind === 'sticker' ? e.motif : undefined;
          if (motif?.startsWith('sheet-')) return null;
          const hero =
            e.kind === 'photo' &&
            spec.photos.some((p) => p.role === 'key' && p.photoId === e.photoId);
          const inPocket = pocket && e.kind === 'photo' && !hero;
          const ink =
            motif &&
            (/^(ink-|pencil-)/.test(motif) ||
              [
                'tangle-ink',
                'tea-sketch',
                'train-ink',
                'pen-bolts',
                'pen-arrow',
                'punch-stamp',
              ].includes(motif));
          const label = {
            date: 'diary-dateline',
            weather: 'diary-weather',
            mood: 'diary-mood',
            text: 'diary-writing',
            tape: 'diary-tape',
          } as const;
          const role = e.kind in label ? label[e.kind as keyof typeof label] : '';
          return (
            <div
              key={i}
              className={`placed diary-piece ${role}${ink ? ' diary-ink' : ''}${motif === 'tea-ring' ? ' diary-stain' : ''}${motif === 'receipt' ? ' tea-receipt' : ''}`}
              data-element={i}
              data-kind={e.kind}
              data-motif={motif}
              data-layer={e.layer}
              data-show={visible}
              data-pocket-print={inPocket ? (pocketOpen ? 'out' : 'in') : undefined}
              inert={!visible}
              data-hero={hero || undefined}
              style={{
                ...({ '--piece-end': (e.x + e.w) * 100 + 'cqw' } as CSSProperties),
                left: e.x * 100 + '%',
                top: e.y * 100 + '%',
                width: e.w * 100 + '%',
                height: e.h * 100 + '%',
                transform: `rotate(${e.rotation}deg) scale(${e.scale})`,
                zIndex: e.layer,
                color: e.color,
              }}
            >
              {motif === 'life-pocket' ? (
                <Pocket
                  open={pocketOpen}
                  onToggle={() => setPocketOpen(!pocketOpen)}
                  preview={preview}
                />
              ) : (
                contents(e, spec, onZoom, preview, playback)
              )}
            </div>
          );
        })}
        <Spiral side={leaf} />
      </BookLeaf>
    );
  });
}

export function DaySpread({
  spec,
  at,
  times,
  flip,
  playback,
}: {
  spec: DaySpec;
  at: number;
  times: number[];
  flip?: ReactNode;
  playback?: Playback;
}) {
  const [zoom, setZoom] = useState<ZoomTarget | null>(null);
  return (
    <>
      <BookBinding month={spec.date.slice(0, 7)}>
        <DayLeaves spec={spec} at={at} times={times} onZoom={setZoom} playback={playback} />
        {flip}
      </BookBinding>
      {zoom && <PrintZoom spec={spec} target={zoom} onClose={() => setZoom(null)} />}
    </>
  );
}
