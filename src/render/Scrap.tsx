import type { DaySpec, MusicCarrier } from '../types/dayspec';
import { carrierLabels } from '../rules/musicCarrier';
import { CutTitle } from './CutTitle';
import { CollageSticker } from './stickers/CollageSticker';
import { PaperDetail } from './stickers/PaperDetail';

const scans = new Set([
  'binder',
  'black-tape',
  'case',
  'checks',
  'clip',
  'graph',
  'looseleaf',
  'masking',
  'pen-arrow',
  'pen-bolts',
  'pin',
  'punch-stamp',
  'rail-ticket',
  'receipt',
  'show-stub',
  'tangle-ink',
  'tea-ring',
  'tea-sketch',
  'train-ink',
  'wire-loop',
  'xerox',
]);

const material = (name: string) => import.meta.env.BASE_URL + 'scraps/materials/' + name + '.webp';

export function Scan({ name }: { name: string }) {
  return (
    <img
      className="scrap-scan"
      draggable={false}
      alt=""
      src={`${import.meta.env.BASE_URL}scraps/047/${name}.webp`}
    />
  );
}

export function Spiral({ side }: { side: 'left' | 'right' }) {
  return (
    <div className={'diary-coils coils-' + side} aria-hidden="true">
      {Array.from({ length: 15 }, (_, i) => (
        <Scan key={i} name="wire-loop" />
      ))}
    </div>
  );
}

const drawings: Record<string, string> = {
  'ink-cloud':
    'M18 57q-13-5-12-16t16-10q4-16 20-13 9-15 25-7 12 2 14 13 16-3 18 14 4 14-15 16z m-5-9q-9-13 5-18m24-13q14-8 25 3',
  'ink-rain':
    'M19 15l-9 18m31-24-12 27m24-17-10 27m25-26-13 32m27-30-5 16m8 5-6 12M17 44 9 60m24-14-8 16m20-9-3 8',
  'pencil-sprig':
    'M15 67Q38 38 81 8M35 45Q9 42 10 24q24 4 25 21M50 32Q34 19 41 8q16 7 9 24m7-7q18 2 30-10-22-1-30 10M29 53q10-17 27-12-5 13-27 12',
  'pencil-lines': 'M7 22q31-8 57-4m-55 9q40-7 80-4M20 39q38-3 61 0',
  'ink-exclaim': 'M18 12l-5 31 7-33m-9 42 3-1m24-37-4 22m-1 8h1m30-21-5 13m-1 6h1',
  'ink-route': 'M8 53q14-8 27-5t23-14 28-9m-79 34q22-12 31-7m29-22 19-5-13-10m-17 41 12-11 14 14',
  'ink-question': 'M26 19q7-14 24-12 22 3 10 16L47 35l-2 9m-2 8-1 4m34-29 12 2m-4 8 4 5',
  'ink-clock': 'M60 32a25 24 0 1 1-50 0 25 24 0 1 1 50 0zm-25-13v15l10 5M35 10v4m23 18h-4',
  'ink-mountain':
    'M6 59 37 18l15 18 12-26 27 48M29 29l9 7 5-7m13 0 9 4 6-9M10 60l83-2m-45 0q10-13 17-9t9-5',
  'ink-sun':
    'M54 34a15 14 0 1 1-30 0 15 14 0 1 1 30 0zM39 7v8m0 38v10M8 33h10m44 1h10m-54-19 7 8m30 24 7 8M16 54l9-8m30-26 6-8',
};

export function Scrap({ motif, spec }: { motif: string; spec: DaySpec }) {
  if (motif === 'trail-map')
    return <img className="scrap-scan" src={material(motif)} alt="Карта тропы" />;
  if (motif === 'trail-tag') return <span className="trail-tag">ТРОПА</span>;
  if (motif === 'luggage-tag')
    return (
      <span className="luggage-tag">
        <small>БАГАЖ</small>
        <b>Чемодан</b>
        <span>
          {spec.date.slice(-2)}.{spec.date.slice(5, 7)}
        </span>
      </span>
    );
  if (
    motif === 'entry-band' ||
    motif === 'cinema-ticket' ||
    motif === 'bus-pass' ||
    motif === 'food-receipt'
  ) {
    const labels = {
      'entry-band': 'ВХОД',
      'cinema-ticket': 'КИНОБИЛЕТ',
      'bus-pass': 'АВТОБУС',
      'food-receipt': 'КАССОВЫЙ ЧЕК',
    };
    return (
      <span className={`keepsake-print ${motif}`}>
        <b>{labels[motif]}</b>
        <small>
          {spec.date.slice(-2)}.{spec.date.slice(5, 7)} · {spec.number}
        </small>
      </span>
    );
  }
  if (motif === 'title')
    return (
      <CutTitle title={spec.folderName} sets={spec.page.titleAlphabets ?? ['news']} id={spec.id} />
    );
  if (motif === 'receipt')
    return (
      <>
        <Scan name={motif} />
        <div className="receipt-type">
          <small>БУФЕТ</small>
          <b>ЧАЙ</b>
          <span>2 стакана</span>
          <hr />
          <span>Заказ № {String(spec.number).padStart(3, '0')}</span>
          <i>
            {spec.date.slice(-2)}.{spec.date.slice(5, 7)}
          </i>
        </div>
      </>
    );
  if (motif === 'rail-ticket')
    return (
      <>
        <Scan name={motif} />
        <div className="rail-type">
          <small>ЖЕЛЕЗНАЯ ДОРОГА</small>
          <strong>ПРОЕЗДНОЙ БИЛЕТ</strong>
          <span>
            {spec.date.slice(-2)}.{spec.date.slice(5, 7)} · № {String(spec.number).padStart(4, '0')}
          </span>
        </div>
      </>
    );
  if (motif === 'heart') return <span className="pen-heart">♡</span>;
  if (motif === 'crossout')
    return (
      <span className="diary-caption">
        <s>успеть</s>
      </span>
    );
  if (motif === 'repeat-note') return <span className="diary-caption">ещё раз!</span>;
  if (motif === 'tea-note') return <span className="diary-caption">чай ещё тёплый</span>;
  if (scans.has(motif)) return <Scan name={motif} />;
  if (motif.startsWith('paper-')) return <PaperDetail motif={motif} spec={spec} />;
  if (drawings[motif])
    return (
      <svg
        viewBox="0 0 100 70"
        className="pen-drawing"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={drawings[motif]} strokeWidth={motif.startsWith('pencil-') ? 1.3 : 2.3} />
      </svg>
    );
  return <CollageSticker motif={motif.replace(/^object-/, '')} date={spec.date} />;
}

export function MusicKeepsake({ spec, carrier }: { spec: DaySpec; carrier: MusicCarrier }) {
  const song = spec.song;
  if (!song) return null;
  return (
    <div
      className={`music-keepsake carrier-${carrier}`}
      data-carrier={carrier}
      aria-label={carrierLabels[carrier]}
    >
      {carrier !== 'note' && <img draggable={false} alt="" src={material(carrier)} />}
      <div className="music-label">
        <small>{song.year ?? 'Песня дня'}</small>
        <strong>{song.title}</strong>
        <span>{song.artist}</span>
        {(spec.reveal.beats.length > 0 || spec.reveal.peakSec !== null) && (
          <svg
            viewBox="0 0 240 14"
            preserveAspectRatio="none"
            role="img"
            aria-label="Доли и пик песни"
          >
            <path d="M2 8H238" stroke="currentColor" strokeWidth=".7" />
            {spec.reveal.beats.map((beat, i) => (
              <path
                key={i}
                d={`M${2 + beat * 7.8} 8v${i % 4 === 0 ? -6 : 3}`}
                stroke="currentColor"
              />
            ))}
            {spec.reveal.peakSec !== null && (
              <circle cx={2 + spec.reveal.peakSec * 7.8} cy="8" r="4" fill="currentColor" />
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
