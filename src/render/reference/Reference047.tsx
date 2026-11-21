import type { ReactNode } from 'react';
import type { DaySpec, PageElement, PhotoSlot } from '../../types/dayspec';
import { BookLeaf } from '../BookBinding';
import type { ZoomTarget } from '../PrintZoom';
import { moodLabel } from '../stickers/Sticker';
import { formatDate } from '../format';
import { CutTitle } from './CutTitle';
import { heartTrigger } from '../../rules/reference047';
import '@fontsource/neucha/cyrillic-400.css';
import '@fontsource/neucha/latin-400.css';
import './reference047.css';

const material = (name: string) => `${import.meta.env.BASE_URL}scraps/047/${name}.webp`;

function Scan({ name, alt = '' }: { name: string; alt?: string }) {
  return <img className="scrap-scan" draggable={false} src={material(name)} alt={alt} />;
}

type Layer = 'paper' | 'prints' | 'keepsakes' | 'surface';
type Position = [left: number, top: number, width: number, height: number, tilt: number];
function Piece({
  box,
  layer,
  show,
  name,
  children,
  hero,
}: {
  box: Position;
  layer: Layer;
  show: boolean;
  name?: string;
  children?: ReactNode;
  hero?: boolean;
}) {
  const [x, y, w, h, angle] = box;
  return (
    <div
      className={'placed diary-piece ' + (name ?? '')}
      data-layer={layer}
      data-show={show}
      data-hero={hero || undefined}
      inert={!show}
      style={{
        left: x + '%',
        top: y + '%',
        width: w + '%',
        height: h + '%',
        transform: `rotate(${angle}deg)`,
      }}
    >
      {children}
    </div>
  );
}

function Spiral({ side }: { side: 'left' | 'right' }) {
  return (
    <div className={'diary-coils coils-' + side} aria-hidden="true">
      {Array.from({ length: 15 }, (_, i) => (
        <img key={i} src={material('wire-loop')} alt="" draggable={false} />
      ))}
    </div>
  );
}

type OpenPhoto = (target: ZoomTarget) => void;
function Snapshot({
  photo,
  index,
  caption,
  preview,
  onZoom,
}: {
  photo: PhotoSlot;
  index: number;
  caption: string;
  preview: boolean;
  onZoom?: OpenPhoto;
}) {
  const content = (
    <>
      <img src={photo.src} alt="" draggable={false} />
      <span>{caption}</span>
    </>
  );
  return preview ? (
    <div className="diary-print">{content}</div>
  ) : (
    <button
      className="diary-print"
      aria-label={`Увеличить снимок ${index}`}
      onClick={(e) => onZoom?.({ photo, button: e.currentTarget })}
    >
      {content}
    </button>
  );
}

function EntryText({ sentences, spec }: { sentences: string[]; spec: DaySpec }) {
  const together = heartTrigger(sentences.join(' '));
  return (
    <div className="diary-entry" aria-label="Текст записи">
      {sentences.map((s, i) => {
        if (i === spec.key.sentence) {
          const start = s.toLocaleLowerCase('ru').indexOf(spec.key.text.toLocaleLowerCase('ru'));
          if (start >= 0)
            return (
              <p key={i}>
                {s.slice(0, start)}
                <mark>{s.slice(start, start + spec.key.text.length)}</mark>
                {s.slice(start + spec.key.text.length)}
              </p>
            );
        }
        return (
          <p key={i}>
            {i === 1 ? <span className="ink-circle">{s}</span> : s}
            {together && i === sentences.length - 1 && (
              <span className="pen-heart" aria-hidden="true">
                ♡
              </span>
            )}
          </p>
        );
      })}
    </div>
  );
}

function GigTicket({ spec }: { spec: DaySpec }) {
  const song = spec.song;
  if (!song) return null;
  return (
    <div className="diary-gig">
      <Scan name="show-stub" />
      <div className="gig-type">
        <small>♫ &nbsp; ПЕСНЯ ДНЯ</small>
        <strong>{song.title}</strong>
        <span>{song.artist}</span>
        <svg
          viewBox="0 0 240 11"
          preserveAspectRatio="none"
          role="img"
          aria-label="Доли и пик песни"
        >
          <path d="M1 6H239" stroke="currentColor" strokeWidth=".6" />
          {spec.reveal.beats.map((b, i) => (
            <path key={i} d={`M${2 + b * 7.8} 6v${i % 4 === 0 ? -5 : 3}`} stroke="currentColor" />
          ))}
          {spec.reveal.peakSec !== null && (
            <circle cx={2 + spec.reveal.peakSec * 7.8} cy="6" r="3.1" fill="currentColor" />
          )}
        </svg>
      </div>
      <b className="gig-year">{song.year}</b>
    </div>
  );
}

export function Reference047({
  spec,
  at,
  times,
  preview,
  onZoom,
}: {
  spec: DaySpec;
  at: number;
  times: number[];
  preview: boolean;
  onZoom?: OpenPhoto;
}) {
  const { elements } = spec.page;
  const visible = (kind: PageElement['kind'], photoId?: string) => {
    const i = elements.findIndex(
      (e) => e.kind === kind && (!photoId || ('photoId' in e && e.photoId === photoId)),
    );
    return at >= (times[i] ?? 0);
  };
  const hero = spec.photos.find((p) => p.role === 'key')!;
  const support = spec.photos.find((p) => p.role === 'support')!;
  const photoVisible = visible('photo', hero.photoId),
    railVisible = visible('photo', support.photoId);
  const heroTape = photoVisible && visible('tape', hero.photoId);
  const railTape = railVisible && visible('tape', support.photoId);
  const paper = visible('date'),
    words = visible('text'),
    accents = visible('sticker');
  const weather = elements.find((e) => e.kind === 'weather');
  const mood = elements.find((e) => e.kind === 'mood');
  const entry = elements.find((e) => e.kind === 'text');
  const moodVisible = visible('mood');
  const restless = mood?.kind === 'mood' && mood.mood === 'restless';
  const snapshot = (p: PhotoSlot, caption: string) => (
    <Snapshot
      photo={p}
      index={spec.photos.indexOf(p) + 1}
      caption={caption}
      onZoom={onZoom}
      preview={preview}
    />
  );

  return (
    <>
      <BookLeaf
        side="left"
        stock={spec.page.stock}
        className="diary-leaf diary-photo-leaf"
        label="Лист с фотографиями"
      >
        <Piece box={[-7, 25, 65, 62, -12]} layer="paper" show={paper}>
          <Scan name="xerox" />
        </Piece>
        <Piece box={[39, 24, 56, 51, 9]} layer="paper" show={paper}>
          <Scan name="graph" />
        </Piece>
        <Piece box={[8, 2, 48, 6, -3]} layer="keepsakes" show={paper} name="diary-dateline">
          <time dateTime={spec.date}>{formatDate(spec.date)} ’26</time> <i>сб.</i>
        </Piece>
        <Piece box={[63, 0.8, 25, 9, 7]} layer="surface" show={accents} name="diary-ink">
          <Scan name="train-ink" />
        </Piece>
        <Piece box={[5, 9, 85, 25, -4]} layer="keepsakes" show={words} name="diary-masthead">
          <CutTitle
            title={spec.folderName}
            sets={spec.page.titleAlphabets ?? ['news']}
            id={spec.id}
          />
        </Piece>
        <Piece box={[87, 8, 3.8, 10, -11]} layer="surface" show={words}>
          <Scan name="clip" />
        </Piece>
        <Piece box={[10, 35, 76, 44, -7]} layer="prints" show={photoVisible} hero>
          {snapshot(hero, 'Два чая, пожалуйста!')}
        </Piece>
        <Piece box={[12, 34, 23, 6, -18]} layer="surface" show={heroTape} name="diary-tape">
          <Scan name={restless ? 'black-tape' : 'masking'} />
        </Piece>
        <Piece box={[67, 31, 21, 6, 15]} layer="surface" show={heroTape} name="diary-tape">
          <Scan name="masking" />
        </Piece>
        <Piece box={[72, 73, 20, 6, -29]} layer="surface" show={heroTape}>
          <Scan name="checks" />
        </Piece>
        <Piece box={[6, 80, 58, 18, -6]} layer="keepsakes" show={railVisible} name="diary-rail">
          <Scan name="rail-ticket" />
          <div className="rail-type">
            <small>ЖЕЛЕЗНАЯ ДОРОГА</small>
            <strong>ПРОЕЗДНОЙ БИЛЕТ</strong>
            <span>14 НОЯ &nbsp; ◈ &nbsp; № 0047</span>
          </div>
        </Piece>
        <Piece box={[1, 77, 12, 10, 13]} layer="surface" show={accents}>
          <Scan name="binder" />
        </Piece>
        <Piece box={[71, 79, 21, 17, 8]} layer="surface" show={words} name="diary-ink">
          <Scan name="tea-sketch" />
        </Piece>
        <Piece box={[61, 95, 29, 4, -5]} layer="surface" show={words} name="diary-caption">
          чай ещё тёплый
        </Piece>
        <Piece box={[-1, 58, 12, 15, -16]} layer="surface" show={accents} name="diary-ink">
          <Scan name="pen-bolts" />
        </Piece>
        <Spiral side="left" />
      </BookLeaf>
      <BookLeaf
        side="right"
        stock="white"
        className="diary-leaf diary-ruled"
        label="Лист с записью"
      >
        <Piece box={[65, 9, 37, 29, 16]} layer="paper" show={paper} name="diary-stain">
          <Scan name="tea-ring" />
        </Piece>
        <Piece box={[3, 43, 55, 41, -9]} layer="paper" show={paper}>
          <Scan name="looseleaf" />
        </Piece>
        <Piece box={[9, 3, 39, 8, -5]} layer="keepsakes" show={moodVisible} name="diary-mood">
          <small>настроение</small>
          {mood?.kind === 'mood' && <span>{moodLabel(mood.mood)}</span>}
        </Piece>
        {weather?.kind === 'weather' && (
          <Piece
            box={[62, 2, 32, 9, 4]}
            layer="keepsakes"
            show={visible('weather')}
            name="diary-weather"
          >
            <span>
              ☾ &nbsp;{Math.round(weather.weather.tempC)}° · {weather.weather.hour}:00
            </span>
            <small>
              {weather.weather.place} ·{' '}
              <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                Open-Meteo
              </a>
            </small>
          </Piece>
        )}
        <Piece box={[12, 13, 69, 32, -2]} layer="keepsakes" show={words}>
          {entry?.kind === 'text' && <EntryText sentences={entry.sentences} spec={spec} />}
        </Piece>
        {restless && (
          <Piece box={[83, 14, 15, 13, 9]} layer="surface" show={moodVisible} name="diary-ink">
            <Scan name="tangle-ink" />
          </Piece>
        )}
        <Piece box={[73, 35, 25, 13, -8]} layer="surface" show={accents} name="diary-ink">
          <Scan name="pen-bolts" />
        </Piece>
        <Piece box={[55, 38, 13, 10, -12]} layer="paper" show={accents}>
          <Scan name="case" />
        </Piece>
        <Piece box={[31, 47, 59, 32, 8]} layer="prints" show={railVisible}>
          {snapshot(support, 'на перроне')}
        </Piece>
        <Piece box={[9, 48, 22.5, 38, -10]} layer="keepsakes" show={railVisible} name="tea-receipt">
          <Scan name="receipt" />
          <div>
            <small>БУФЕТ</small>
            <b>ЧАЙ</b>
            <span>2 стакана</span>
            <hr />
            <span>Заказ № 047</span>
            <i>14.11</i>
          </div>
        </Piece>
        <Piece box={[6, 47, 19, 5.3, -22]} layer="surface" show={railTape}>
          <Scan name="checks" />
        </Piece>
        <Piece box={[45, 46, 21, 5.3, 11]} layer="surface" show={railTape} name="diary-tape">
          <Scan name="black-tape" />
        </Piece>
        <Piece box={[78, 46, 4.5, 11, -8]} layer="surface" show={railTape}>
          <Scan name="clip" />
        </Piece>
        <Piece box={[82, 70, 13, 6, -28]} layer="surface" show={accents}>
          <Scan name="pin" />
        </Piece>
        <Piece box={[13, 73, 14, 11, -13]} layer="surface" show={accents} name="diary-ink">
          <Scan name="punch-stamp" />
        </Piece>
        <Piece box={[31, 79, 62, 19, -5]} layer="keepsakes" show={visible('ticket')}>
          <GigTicket spec={spec} />
        </Piece>
        <Piece box={[7, 87, 21, 8, -14]} layer="surface" show={words} name="diary-ink">
          <Scan name="pen-arrow" />
        </Piece>
        <Piece box={[9, 94, 21, 5, -5]} layer="surface" show={words} name="diary-caption">
          ещё раз!
        </Piece>
        {restless && (
          <Piece box={[9, 38, 24, 5, -9]} layer="surface" show={words} name="diary-caption">
            <s>успеть</s>
          </Piece>
        )}
        <Spiral side="right" />
      </BookLeaf>
    </>
  );
}
