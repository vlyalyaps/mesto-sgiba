import type { DayInput, PhotoSlot } from '../types/dayspec';
import { objectsIn } from './objects';
import { rawWords } from './util';

const themes: Record<string, string> = {
  cup: 'Чашка в кадре',
  train: 'По дороге',
  clock: 'Отметка времени',
  case: 'Вещи в дорогу',
  rain: 'Дождливый день',
  snow: 'Снег в кадре',
  sun: 'Солнечный свет',
  moon: 'Вечерний свет',
  cat: 'Кошачий портрет',
  dog: 'Кадр с собакой',
  wave: 'У самой воды',
  book: 'Книжная страница',
  flower: 'Цветы в кадре',
  home: 'Домашний кадр',
  car: 'Кадр из поездки',
  bus: 'Поездка на автобусе',
  phone: 'Телефон в кадре',
  cake: 'К чаю',
  gift: 'Тот самый подарок',
  music: 'Музыка дня',
  cinema: 'День в кино',
  venue: 'Кадр с события',
  food: 'За столом',
  school: 'Учебный день',
  mountain: 'Горный пейзаж',
  leaf: 'Осенние детали',
  key: 'Связка ключей',
  bread: 'Свежий хлеб',
  bike: 'Кадр с велосипедом',
  star: 'Под звёздами',
  ticket: 'Снимок билета',
};

function shortPhrase(text: string) {
  const words = rawWords(text);
  const hanging =
    /^(?:и|или|но|а|да|с|со|у|в|во|на|к|ко|за|о|об|от|до|из|для|по|под|над|про|что|чтобы)$/iu;
  const dependent = /^(?:когда|если|хотя|пока|поскольку|чтобы)\s/iu;
  return (
    words.length >= 2 &&
    words.length <= 5 &&
    !hanging.test(words.at(-1)!) &&
    !dependent.test(text.trim())
  );
}

function objectCaption(text: string) {
  if (/первый\s+снег/iu.test(text)) return 'Первый снег';
  if (/кофе/iu.test(text)) return 'Кофе в кадре';
  if (/кружк/iu.test(text)) return 'Кружка в кадре';
  for (const { motif } of objectsIn([text])) {
    if (themes[motif]) return themes[motif];
  }
}

export function printCaption(
  input: DayInput,
  photo: PhotoSlot,
  keySentence: string,
  sentences: string[],
): string | undefined {
  const index = input.photos.findIndex((asset) => asset.id === photo.photoId);
  const caption = input.photos[index]?.caption?.trim();
  if (caption && shortPhrase(caption)) return caption;

  const others = sentences.filter(
    (sentence) => !sentence.toLowerCase().includes(keySentence.toLowerCase()),
  );
  const source =
    caption ??
    (photo.role === 'key' ? keySentence : (others[index % others.length] ?? keySentence));
  const [clause] = source.split(/[,.;:!?…]|\s+[—–]\s+/u);
  if (shortPhrase(clause)) return clause.trim();

  return objectCaption(source) ?? objectCaption(sentences.join(' ')) ?? 'Снимок дня';
}
