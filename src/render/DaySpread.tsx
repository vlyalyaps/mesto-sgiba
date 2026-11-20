import { useState, type CSSProperties } from 'react';
import type { DaySpec, PageElement, PhotoSlot, WeatherSnapshot } from '../types/dayspec';
import { formatDate } from './format';
import { usePhoto } from './Photo';
import { Sticker, moodLabel } from './stickers/Sticker';
import { PrintZoom, type ZoomTarget } from './PrintZoom';
import './sketchbook.css';

function Print({
  photo,
  spec,
  onZoom,
}: {
  photo: PhotoSlot;
  spec: DaySpec;
  onZoom: (t: ZoomTarget) => void;
}) {
  const shown = usePhoto(photo.src, { mode: spec.mode, duo: spec.duo, grain: spec.paper.grain });
  const index = spec.photos.indexOf(photo) + 1;
  return (
    <button
      className="day-print"
      onClick={(e) => onZoom({ photo, button: e.currentTarget })}
      aria-label={`Увеличить снимок ${index}`}
    >
      <img
        src={shown?.url ?? photo.src}
        draggable={false}
        alt=""
        style={{
          objectPosition: `${(photo.crop.x + photo.crop.w / 2) * 100}% ${(photo.crop.y + photo.crop.h / 2) * 100}%`,
        }}
      />
      <small>
        {String(index).padStart(2, '0')} / {String(spec.photos.length).padStart(2, '0')}
      </small>
    </button>
  );
}
function weatherIcon({ code, hour }: WeatherSnapshot) {
  if (code === 45 || code === 48) return 'fog';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if (code >= 51) return 'rain';
  if (code >= 2) return 'cloud';
  return hour < 7 || hour > 18 ? 'moon' : 'sun';
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
function contents(e: PageElement, spec: DaySpec, onZoom: (t: ZoomTarget) => void) {
  switch (e.kind) {
    case 'photo': {
      const p = spec.photos.find((p) => p.photoId === e.photoId);
      return p && <Print photo={p} spec={spec} onZoom={onZoom} />;
    }
    case 'tape':
      return <i className="washi" />;
    case 'sticker':
      return <Sticker motif={e.motif} />;
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
          <Sticker motif={weatherIcon(e.weather)} />
          <div>
            <b>
              {Math.round(e.weather.tempC)}° · {e.weather.hour}:00
            </b>
            <small>{e.weather.place}</small>
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

export function DaySpread({ spec }: { spec: DaySpec }) {
  const [zoom, setZoom] = useState<ZoomTarget | null>(null);
  return (
    <>
      <div
        className="day-spread"
        style={
          {
            '--stock': `url("${import.meta.env.BASE_URL}textures/${spec.page.stock}.webp")`,
            '--marker': spec.page.marker,
          } as CSSProperties
        }
      >
        {(['left', 'right'] as const).map((leaf) => (
          <section
            key={leaf}
            className={'journal-leaf leaf-' + leaf}
            aria-label={leaf === 'left' ? 'Лист с фотографиями' : 'Лист с записью'}
          >
            {spec.page.elements.map(
              (e, i) =>
                e.leaf === leaf && (
                  <div
                    key={i}
                    className={'placed placed-' + e.kind}
                    data-element={i}
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
                    {contents(e, spec, setZoom)}
                  </div>
                ),
            )}
          </section>
        ))}
      </div>
      {zoom && <PrintZoom spec={spec} target={zoom} onClose={() => setZoom(null)} />}
    </>
  );
}
