import type { DayInput, PhotoSlot } from '../types/dayspec';
import { rawWords } from './util';

export function printCaption(
  input: DayInput,
  photo: PhotoSlot,
  keySentence: string,
  sentences: string[],
): string | undefined {
  const index = input.photos.findIndex((asset) => asset.id === photo.photoId);
  const caption = input.photos[index]?.caption?.trim();
  if (caption) return caption;
  const others = sentences.filter(
    (sentence) => !sentence.toLowerCase().includes(keySentence.toLowerCase()),
  );
  const words = rawWords(
    photo.role === 'key' ? keySentence : (others[index % others.length] ?? keySentence),
  ).slice(0, 5);
  return words.length ? words.join(' ') : undefined;
}
