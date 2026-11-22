import type { MusicCarrier } from '../types/dayspec';

export const carrierLabels: Record<MusicCarrier, string> = {
  vinyl: 'пластинка в конверте',
  cassette: 'кассета с подписанной этикеткой',
  cd: 'CD в коробке с вкладышем',
  mp3: 'обрывок плейлиста',
  stream: 'распечатка экрана плеера',
  note: 'листок с названием песни',
};

export function musicCarrier(year: number | null): MusicCarrier {
  if (year === null || !Number.isFinite(year)) return 'note';
  if (year < 1980) return 'vinyl';
  if (year <= 1995) return 'cassette';
  if (year <= 2005) return 'cd';
  if (year <= 2014) return 'mp3';
  return 'stream';
}
