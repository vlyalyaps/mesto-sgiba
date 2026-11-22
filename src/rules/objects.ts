import { lowerWords } from './util';

const objects: Record<string, string[]> = {
  cup: ['чай', 'чаш', 'кофе', 'стакан', 'какао'],
  train: ['вокзал', 'поезд', 'вагон', 'перрон', 'электричк', 'железнодорож'],
  clock: ['опозд', 'минут', 'час', 'табло', 'курант'],
  case: ['чемодан', 'багаж'],
  rain: ['дожд', 'ливен'],
  snow: ['снег', 'снеж', 'мороз'],
  sun: ['солн', 'закат'],
  moon: ['ноч', 'фонар', 'лампа', 'лампу', 'night'],
  cat: ['кот', 'кошк'],
  dog: ['собак', 'щен'],
  wave: ['море', 'моря', 'морю', 'морск', 'река', 'реки', 'реке', 'речк', 'волн', 'пруд'],
  book: ['книг', 'книж', 'читали'],
  flower: ['цветок', 'цветы', 'букет'],
  home: ['дом', 'кухн'],
  car: ['машин', 'автомоб'],
  bus: ['автобус'],
  phone: ['телефон', 'звон'],
  cake: ['торт', 'пирог'],
  gift: ['подар'],
  music: ['музык', 'песн', 'наушник'],
  cinema: ['кино', 'фильм'],
  venue: ['фестивал', 'концерт', 'выставк', 'клуб'],
  food: [
    'едой',
    'еда',
    'еду',
    'кафе',
    'обед',
    'завтрак',
    'ужин',
    'пицц',
    'бургер',
    'столов',
    'донер',
    'шаурм',
    'салат',
    'тарел',
  ],
  school: ['школ', 'парта', 'пары', 'лекци'],
  mountain: ['горн', 'горах', 'горы', 'хреб', 'троп'],
  camera: ['камер', 'сним', 'фото'],
  leaf: ['лист', 'осен'],
  key: ['ключ'],
  bread: ['хлеб', 'булоч'],
  bike: ['велосипед', 'велик'],
  star: ['звезд', 'салют'],
  ticket: ['билет', 'отправлен'],
};

export function objectsIn(sentences: string[]) {
  const hits: { motif: string; sentence: number; word: string }[] = [];
  const seen = new Set<string>();
  sentences.forEach((s, sentence) => {
    for (const word of lowerWords(s)) {
      for (const [motif, stems] of Object.entries(objects)) {
        if (!seen.has(motif) && stems.some((stem) => word.startsWith(stem))) {
          hits.push({ motif, sentence, word });
          seen.add(motif);
          break;
        }
      }
    }
  });
  return hits;
}
