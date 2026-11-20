import type { Mood } from '../../types/dayspec';
import { drawings } from './art';

const faces: Record<Mood, readonly [string, string]> = {
  calm: ['Спокойно', 'M13 21q3 4 7 0m9-1q3 4 7 0m-17 9q5 5 11 0'],
  joyful: ['Радостно', 'M13 21q3-6 7-1m8-1q4-5 8 0 M16 26q8 18 17-1z'],
  tired: ['Устало', 'M12 22l9 1m7-2 9-1m-17 9q5-1 9 1'],
  restless: ['Тревожно', 'M12 17l8 3m8-1 8-5m-20 9h2m12-1h2m-14 10 4-3 4 2 4-3'],
  wistful: ['Тоскливо', 'M12 19l8-3m8 0 7 2m-20 5h2m13-1h2m-14 11q6-8 13-2'],
  curious: ['Любопытно', 'M12 18l7-4m9 3 8 1m-22 7q2-6 5-1m9 0q3-8 7-1m-14 9q4 2 7-2'],
  proud: ['Гордо', 'M12 19l8 2m8 0 7-4m-21 7 5 1m10-1 5-1m-16 8q8 6 15-3'],
};
const faceOutline = 'M23 5C45 1 52 36 32 43 4 52-4 12 23 5z ';
export function moodLabel(mood: Mood) {
  return faces[mood][0];
}
export function Sticker({ motif, label }: { motif: string; label?: string }) {
  const face = Object.hasOwn(faces, motif) ? faces[motif as Mood] : null;
  const [name, path] = face
    ? [face[0], faceOutline + face[1]]
    : (drawings[motif] ?? drawings.spark);
  return (
    <svg
      viewBox="0 0 48 48"
      role={label ? 'img' : undefined}
      aria-label={label ? name : undefined}
      aria-hidden={!label}
      focusable="false"
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d={path} stroke="#fff7e6" strokeWidth="6.6" fill="#f4dfaf" />
      <path d={path} stroke="currentColor" strokeWidth="2.1" fill="none" />
    </svg>
  );
}
