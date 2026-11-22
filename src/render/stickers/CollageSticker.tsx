import { Sticker } from './Sticker';

const illustrated = new Set([
  'cup',
  'case',
  'train',
  'clock',
  'mountain',
  'sun',
  'flower',
  'leaf',
  'ticket',
  'moon',
  'camera',
  'arrow',
]);
const labels: Record<string, { text: string; ink: string; paper: string }> = {
  'rail-label': { text: 'В ПУТИ', ink: '#2b5354', paper: '#dfc58b' },
  'tea-label': { text: 'ЧАЙ', ink: '#853a28', paper: '#e9caa0' },
  'ridge-label': { text: 'ГОРЫ', ink: '#f3e4ba', paper: '#496050' },
};

export function CollageSticker({ motif, date }: { motif: string; date: string }) {
  if (illustrated.has(motif)) {
    return (
      <img
        className="collage-art"
        src={`${import.meta.env.BASE_URL}stickers/${motif}.webp`}
        alt=""
        draggable={false}
      />
    );
  }
  if (motif === 'postmark') {
    return (
      <svg viewBox="0 0 144 83" className="collage-postmark" aria-hidden="true">
        <circle
          cx="41"
          cy="41"
          r="35"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="19 1 36 1 35 3"
        />
        <circle cx="41" cy="41" r="29" fill="none" stroke="currentColor" strokeWidth=".7" />
        <path
          d="M11 29h60m-60 25h60 M80 26q12-8 25 0t27 0M80 36q12-8 25 0t27 0M80 46q12-8 25 0t27 0M80 56q12-8 25 0t27 0"
          stroke="currentColor"
          fill="none"
          strokeWidth="1.8"
        />
        <text x="41" y="46" textAnchor="middle" fontSize="12" fontFamily="IBM Plex Mono, monospace">
          {date.slice(8, 10)}.{date.slice(5, 7)}
        </text>
      </svg>
    );
  }
  const label = labels[motif];
  if (label) {
    return (
      <svg viewBox="0 0 140 72" className="collage-label" aria-hidden="true">
        <path
          d="M5 4 36 1l38 1 29 2 30-2 4 13-6 6 6 8-3 7 6 8-5 8 2 16-36 1-24-2-27 3L3 67l2-15-4-8 5-8-4-8 5-7-4-8z"
          fill={label.paper}
        />
        <path
          d="M13 14h112v44H13zM20 22h98v28H20z"
          fill="none"
          stroke={label.ink}
          strokeDasharray="24 1 9 .5 47 1"
          strokeWidth="1.5"
        />
        <text
          x="70"
          y="43"
          textAnchor="middle"
          fill={label.ink}
          fontSize="20"
          fontFamily="Literata Variable, serif"
          fontWeight="600"
          letterSpacing="3"
        >
          {label.text}
        </text>
      </svg>
    );
  }
  if (motif === 'spark' || motif === 'star')
    return (
      <svg viewBox="0 0 64 52" className="collage-sparks" fill="none" aria-hidden="true">
        <path
          d="M22 3q1 19 18 23-16 3-18 23-3-18-19-22C15 25 20 18 22 3Zm25 2q2 9 11 11-9 1-10 11-2-9-10-10 8-3 9-12Z"
          fill="#cf943e"
          stroke="#784e2b"
          strokeWidth="1.3"
        />
        <path d="M52 35v13m-6-7 13 1" stroke="#9f5d36" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  return (
    <span className="collage-doodle">
      <Sticker motif={motif} />
    </span>
  );
}
