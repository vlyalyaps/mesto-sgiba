import { useState, type ReactNode } from 'react';
import { BookBinding, BookLeaf } from './BookBinding';
import type { DaySpec, PageElement, PhotoSlot } from '../types/dayspec';
import type { WeatherReading } from '../weather';
import { formatDate } from './format';
import { usePhoto } from './Photo';
import { CollageSticker } from './stickers/CollageSticker';
import { PaperDetail } from './stickers/PaperDetail';
import { Sticker, moodLabel } from './stickers/Sticker';
import { PrintZoom, type ZoomTarget } from './PrintZoom';
import { Reference047 } from './reference/Reference047';
import { isReference047 } from '../rules/reference047';
import './sketchbook.css';

function Print({
  photo,
  spec,
  onZoom,
  preview,
}: {
  photo: PhotoSlot;
  spec: DaySpec;
  onZoom?: (t: ZoomTarget) => void;
  preview?: boolean;
}) {
  const shown = usePhoto(photo.src, { mode: spec.mode, duo: spec.duo, grain: spec.paper.grain });
  const index = spec.photos.indexOf(photo) + 1;
  const content = (
    <>
      <img
        src={shown?.url ?? photo.src}
        data-print-id={photo.photoId}
        draggable={false}
        alt=""
        style={{
          objectPosition: `${(photo.crop.x + photo.crop.w / 2) * 100}% ${(photo.crop.y + photo.crop.h / 2) * 100}%`,
        }}
      />
      <small>
        {String(index).padStart(2, '0')} / {String(spec.photos.length).padStart(2, '0')}
      </small>
    </>
  );
  return preview ? (
    <div className="day-print">{content}</div>
  ) : (
    <button
      className="day-print"
      onClick={(e) => onZoom?.({ photo, button: e.currentTarget })}
      aria-label={`Увеличить снимок ${index}`}
    >
      {content}
    </button>
  );
}
function weatherIcon({ code, hour, windKph, isDay }: WeatherReading) {
  if (code === 45 || code === 48) return 'fog';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if (code >= 51) return 'rain';
  if ((windKph ?? 0) >= 30) return 'wind';
  if (code >= 2) return 'cloud';
  return (isDay ?? (hour >= 7 && hour <= 18)) ? 'sun' : 'moon';
}
function SongTicket({ spec }: { spec: DaySpec }) {
  const s = spec.song;
  if (!s) return null;
  return (
    <div className="song-ticket">
      <div className="ticket-main">
        <span className="ticket-kicker">♫ &nbsp; ПЕСНЯ ДНЯ</span>
        <strong>{s.title}</strong>
        <span>{s.artist}</span>
        <svg
          viewBox="0 0 220 14"
          preserveAspectRatio="none"
          aria-label="Доли и пик песни"
          role="img"
        >
          <path d="M0 8H220" stroke="currentColor" strokeWidth=".6" />
          {spec.reveal.beats.map((b, i) => (
            <path key={i} d={`M${2 + b * 7.15} 8v${i % 4 === 0 ? -6 : 3}`} stroke="currentColor" />
          ))}
          {spec.reveal.peakSec !== null && (
            <circle cx={2 + spec.reveal.peakSec * 7.15} cy="8" r="3" fill="currentColor" />
          )}
        </svg>
      </div>
      <span className="ticket-stub">{s.year ?? '♫'}</span>
    </div>
  );
}
function writing(sentences: string[], spec: DaySpec) {
  return sentences.map((s, i) => {
    if (i !== spec.key.sentence) return <p key={i}>{s}</p>;
    const at = s.toLowerCase().indexOf(spec.key.text.toLowerCase());
    return (
      <p key={i}>
        {at > 0 && <span className="transition-words">{s.slice(0, at)}</span>}
        <mark>{at < 0 ? s : s.slice(at, at + spec.key.text.length)}</mark>
        {at >= 0 ? s.slice(at + spec.key.text.length) : ''}
      </p>
    );
  });
}
function contents(
  e: PageElement,
  spec: DaySpec,
  onZoom?: (t: ZoomTarget) => void,
  preview = false,
) {
  switch (e.kind) {
    case 'photo': {
      const p = spec.photos.find((p) => p.photoId === e.photoId);
      return p && <Print photo={p} spec={spec} onZoom={onZoom} preview={preview} />;
    }
    case 'tape':
      return <i className={'washi washi-' + (e.rotation > 0 ? 'stripe' : 'plain')} />;
    case 'sticker':
      return e.motif.startsWith('paper-') ? (
        <PaperDetail motif={e.motif} spec={spec} />
      ) : (
        <CollageSticker motif={e.motif} date={spec.date} />
      );
    case 'mood':
      return (
        <div className="mood-note">
          <Sticker motif={e.mood} />
          <span>{moodLabel(e.mood)}</span>
        </div>
      );
    case 'weather':
      return (
        <div className="weather-note">
          <Sticker motif={weatherIcon(e.weather)} label="Погода" />
          <div>
            <b>
              {Math.round(e.weather.tempC)}° · {e.weather.hour}:00
            </b>
            <small>{e.weather.place}</small>
            <a
              className="weather-credit"
              href="https://open-meteo.com/"
              rel="noreferrer"
              target="_blank"
            >
              Open-Meteo ↗
            </a>
          </div>
        </div>
      );
    case 'date':
      return <time dateTime={spec.date}>{formatDate(spec.date)}</time>;
    case 'ticket':
      return <SongTicket spec={spec} />;
    case 'text':
      return (
        <div className="handwriting" tabIndex={0} aria-label="Текст записи">
          {writing(e.sentences, spec)}
        </div>
      );
  }
}

export function DayLeaves({
  spec,
  at = Infinity,
  times = [],
  preview = false,
  onZoom,
}: {
  spec: DaySpec;
  at?: number;
  times?: number[];
  preview?: boolean;
  onZoom?: (target: ZoomTarget) => void;
}) {
  if (isReference047(spec)) {
    return <Reference047 spec={spec} at={at} times={times} preview={preview} onZoom={onZoom} />;
  }
  return (['left', 'right'] as const).map((leaf) => (
    <BookLeaf
      key={leaf}
      side={leaf}
      stock={spec.page.stock}
      marker={spec.page.marker}
      label={leaf === 'left' ? 'Лист с фотографиями' : 'Лист с записью'}
    >
      {spec.page.elements.map((e, i) => {
        if (e.leaf !== leaf) return null;
        const visible = at >= (times[i] ?? 0);
        return (
          <div
            key={i}
            className={'placed placed-' + e.kind}
            data-element={i}
            data-motif={e.kind === 'sticker' ? e.motif : undefined}
            data-show={visible}
            inert={!visible}
            data-hero={
              (e.kind === 'photo' &&
                spec.photos.some((p) => p.role === 'key' && p.photoId === e.photoId)) ||
              undefined
            }
            style={{
              left: e.x * 100 + '%',
              top: e.y * 100 + '%',
              width: e.w * 100 + '%',
              height: e.h * 100 + '%',
              transform: `rotate(${e.rotation}deg) scale(${e.scale})`,
              zIndex: e.layer,
              color: e.color,
            }}
          >
            {contents(e, spec, onZoom, preview)}
          </div>
        );
      })}
    </BookLeaf>
  ));
}

export function DaySpread({
  spec,
  at,
  times,
  flip,
}: {
  spec: DaySpec;
  at: number;
  times: number[];
  flip?: ReactNode;
}) {
  const [zoom, setZoom] = useState<ZoomTarget | null>(null);
  return (
    <>
      <BookBinding month={spec.date.slice(0, 7)}>
        <DayLeaves spec={spec} at={at} times={times} onZoom={setZoom} />
        {flip}
      </BookBinding>
      {zoom && <PrintZoom spec={spec} target={zoom} onClose={() => setZoom(null)} />}
    </>
  );
}
