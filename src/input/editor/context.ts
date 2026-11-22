import type { DaySpec, Mood, Overrides, Point } from '../../types/dayspec';
import type { SheetDesign, SheetItem, SheetLeaf } from '../../types/sheet';
import type { places } from '../../weather';
import type { usePhotos } from '../usePhotos';
import type { SongChoice } from '../SongPicker';
import type { Cutout } from './catalog';

export type View = 'both' | SheetLeaf;
export type Tab = 'day' | 'stickers' | 'text' | 'paper' | 'scene' | 'layers';
export type PlaceKey = keyof typeof places;
export type DayField = 'date' | 'text' | 'photos' | 'song';
export type DayErrors = Partial<Record<DayField, string>>;

/** Сама запись: её поля — первая вкладка редактора. */
export interface DraftBridge {
  saved: boolean;
  number: number;
  /** Позже этого числа день не записать. */
  lastDate: string;
  date: string;
  onDate(date: string): void;
  text: string;
  onText(text: string): void;
  mood: Mood | undefined;
  onMood(mood: Mood | undefined): void;
  photos: ReturnType<typeof usePhotos>;
  choice: SongChoice;
  onChoice(next: SongChoice): void;
  /** У сохранённого дня погода уже записана: null. */
  weather: {
    on: boolean;
    onToggle(on: boolean): void;
    place: PlaceKey;
    onPlace(place: PlaceKey): void;
  } | null;
  errors: DayErrors;
}

/** Общие действия, которыми пользуются холст и все панели. */
export interface Editor extends DraftBridge {
  /** День по правилам, без правок листа. */
  base: DaySpec;
  /** Тот же день с правками: его и рисуем. */
  spec: DaySpec;
  edits: Overrides;
  design: SheetDesign;
  /** Вклейки, которые сейчас есть на листе, снизу вверх. */
  items: SheetItem[];
  selected: SheetItem[];
  /** Цвета снимков дня. */
  palette: string[];
  view: View;
  select(ids: string[]): void;
  reveal(leaf: SheetLeaf): void;
  setEdits(patch: Partial<Overrides>, tag?: string): void;
  changeDesign(next: (design: SheetDesign) => SheetDesign, tag?: string): void;
  changeItems(next: (items: SheetItem[]) => SheetItem[], tag?: string): void;
  update(ids: string[], next: (item: SheetItem) => SheetItem, tag?: string): void;
  add(cut: Cutout, at?: Point): void;
  remove(ids: string[]): void;
  duplicate(ids: string[]): void;
  /** Открыть вкладку «День» на этом поле. */
  focusField(field: DayField): void;
  pickPhotos(): void;
  play(): void;
}
