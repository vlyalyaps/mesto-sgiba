/**
 * Контракт проекта «Место сгиба».
 *
 * DayInput — то, что собирает ввод: текст, фото, песня и их признаки.
 * DaySpec  — то, что выдают правила (src/rules) и из чего рисуется книжка (src/render).
 *
 * Отрисовка читает только DaySpec. Один и тот же DayInput всегда даёт один и тот же DaySpec.
 * DaySpec не хранится как истина: при каждом открытии дня его заново считают из DayInput
 * (правила чистые, а src своих фото после перезагрузки — свежие blob-ссылки). dayspec.json в ZIP —
 * снимок для прозрачности. Меняется отдельным маленьким PR, о котором знают оба.
 */

// ---------- Вход ----------

export interface DayInput {
  /** Дата дня, 'YYYY-MM-DD'. */
  date: string;
  /** Порядковый номер дня в архиве, с 1. */
  number: number;
  /** Текст дня, как его написал человек. */
  text: string;
  /** От 1 до 5 фото в порядке, который выбрал человек. */
  photos: PhotoInput[];
  /** Песня дня; null, если её нет. */
  song: SongInput | null;
  /** Ручные правки автора поверх правил. */
  overrides?: Overrides;
}

export interface PhotoInput {
  id: string;
  /** blob: для своих фото, путь от BASE_URL для демо-дней ('demo/photos/cups.svg'). */
  src: string;
  width: number;
  height: number;
  /** Точка, на которую указал человек, в долях 0..1. Без неё правила выбирают сами. */
  focus?: Point;
  /** 3–5 цветов снимка по убыванию доли, '#rrggbb'. */
  palette: string[];
  /** Средняя светлота 0..1. */
  lightness: number;
}

export interface SongInput {
  /** Каталог Apple, ссылка, свой файл человека или два касания «медленная/быстрая, тихая/громкая». */
  source: 'itunes' | 'link' | 'own-file' | 'taps';
  trackId: number | null;
  title: string;
  artist: string;
  /** Страница трека в магазине: значок Apple Music у плеера. */
  trackViewUrl: string | null;
  /** Официальный 30-секундный фрагмент. Только поток, нигде не сохраняем. */
  previewUrl: string | null;
  artworkUrl: string | null;
  /** Самый ранний год среди версий песни у исполнителя; человек может поправить. */
  year: number | null;
  genre: string | null;
  /** Признаки звука по фрагменту или по двум касаниям. */
  features: SongFeatures | null;
}

export interface SongFeatures {
  /** Темп, ударов в минуту, примерно. */
  bpm: number;
  /** Средняя громкость 0..1. */
  energy: number;
  /** Разброс громкости 0..1. */
  energySpread: number;
  /** Секунда пика громкости внутри фрагмента. */
  peakSec: number;
  /** Сильные доли в секундах: для раскрытия без звука. */
  beats?: number[];
  /** true — измерено по звуку; false — тестовые или ручные значения. */
  measured: boolean;
}

export interface Overrides {
  /** Индекс предложения, которое автор сделал главным. */
  keySentence?: number;
  keyPhotoId?: string;
  folderName?: string;
}

export interface Point {
  x: number;
  y: number;
}

// ---------- Книжка ----------

/** Четыре режима обработки фото из docs/rules.md. */
export type PhotoMode = 'warm' | 'film' | 'duotone' | 'quiet';

/** 1 фото — окно, 2 — диптих, 3–5 — контактный лист. */
export type Layout = 'window' | 'diptych' | 'contact';

export interface DaySpec {
  /** Версия формата. */
  v: 1;
  /** 'YYYY-MM-DD-NNN'. */
  id: string;
  date: string;
  number: number;
  /** Название папки: деталь из главной фразы, 3–7 слов, без оценок. */
  folderName: string;

  /** Главная фраза: получает разворот. */
  key: KeyPhrase;
  /** Остальные фразы по порядку: узкие складки. */
  folds: Fold[];

  photos: PhotoSlot[];
  layout: Layout;
  mode: PhotoMode;

  paper: Paper;
  /** Краска подписей '#rrggbb' из выраженного цвета снимков. */
  ink: string;
  /** Две краски из снимков для режима duotone: [тени, света], '#rrggbb'. */
  duo: [string, string];

  rhythm: Rhythm;
  reveal: Reveal;

  /** Песня для плеера: только ссылки, без звука. */
  song: SongRef | null;

  /** Оборот «Почему так»: по строке на каждое сработавшее правило. */
  why: WhyLine[];
}

export interface KeyPhrase {
  text: string;
  /** Индекс предложения в тексте. */
  sentence: number;
  /** Почему эта фраза главная. */
  by: 'transition' | 'concrete' | 'last' | 'author';
  /** Слово-переход, если по нему: «а потом», «вдруг»… */
  transition?: string;
}

export interface Fold {
  text: string;
  sentence: number;
  /** Ширина складки в долях ширины разворота, 0..1. */
  width: number;
  side: 'before' | 'after';
}

export interface PhotoSlot {
  photoId: string;
  src: string;
  role: 'key' | 'support';
  /** Фрагмент, который видно в закрытой книжке, в долях 0..1. */
  crop: Rect;
  /** Кадры внахлёст («мы», имена) или раздельно в широком поле («один»). */
  overlap: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Paper {
  /** Тон складок: -1 серо-голубой … 1 кремовый. */
  tone: number;
  /** Тон разворота. «Холодно, но пили какао» — холодные складки, тёплый разворот. */
  spreadTone: number;
  /** Яркость бумаги 0..1: слова о свете. */
  brightness: number;
  /** Глубина теней на сгибах 0..1. */
  shadow: number;
  /** Ширина полей 0..1: чем тише, тем больше пустой бумаги. */
  margin: number;
  /** Старение 0..1: год песни и «как раньше». */
  age: number;
  /** Зерно 0..1: энергия песни. */
  grain: number;
}

export interface Rhythm {
  /** Складка на 4 или 8 долей. */
  beatsPerFold: 4 | 8;
  /** Теснота полос 0..1. */
  density: number;
}

export interface Reveal {
  /** Длительность раскрытия разворота, мс. */
  durationMs: number;
  /** Секунда фрагмента, на которой разворот раскрыт полностью; null — без песни. */
  peakSec: number | null;
  /** За сколько секунд до пика стартует звук. */
  prerollSec: number;
  /** Сильные доли для раскрытия без звука. */
  beats: number[];
}

export interface SongRef {
  trackId: number | null;
  title: string;
  artist: string;
  trackViewUrl: string | null;
  previewUrl: string | null;
  artworkUrl: string | null;
  year: number | null;
}

export interface WhyLine {
  /** Какой параметр изменило правило, например 'rhythm.beatsPerFold'. */
  param: string;
  /** Причина обычным языком: «Складки тесные: песня быстрая, около 128 ударов в минуту». */
  text: string;
}
