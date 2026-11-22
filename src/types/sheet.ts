/**
 * Лист, который автор дособрал в редакторе. Хранится в DayInput.overrides.design:
 * правила по-прежнему считают день, а правки ложатся поверх их раскладки.
 */
import type { CutAlphabet, MusicCarrier, PaperStock, Point, Rect } from './dayspec';

export type SheetLeaf = 'left' | 'right';

export type SheetFont =
  | 'caveat'
  | 'caveat-bold'
  | 'neucha'
  | 'literata'
  | 'literata-italic'
  | 'literata-bold'
  | 'golos'
  | 'golos-black'
  | 'mono'
  | `cut-${CutAlphabet}`;

export type PrintFrame =
  'plain' | 'polaroid' | 'dark' | 'film' | 'torn' | 'round' | 'circle' | 'arch' | 'stamp' | 'none';

export type ImageTone = 'bw' | 'sepia' | 'warm' | 'cool' | 'faded' | 'punchy';
export type Ruling = 'plain' | 'ruled' | 'lines' | 'grid' | 'dots' | 'staff' | 'diagonal';
export type SpiralLook = 'metal' | 'dark' | 'gold' | 'white' | 'none';

/** Вид одной вклейки. Чего нет, то остаётся как у правил. */
export interface PieceLook {
  opacity?: number;
  flip?: boolean;
  blend?: 'normal' | 'multiply' | 'screen' | 'overlay';
  /** 0 — без тени, 1 — самая глубокая. */
  shadow?: number;
  color?: string;
  fill?: string;
  font?: SheetFont;
  /** Кегль в процентах ширины листа. */
  size?: number;
  align?: 'left' | 'center' | 'right';
  upper?: boolean;
  lineHeight?: number;
  spacing?: number;
  frame?: PrintFrame;
  tone?: ImageTone;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  zoom?: number;
  pan?: Point;
  /** Вклейка правил, которую они сами обрезали сгибом. Снимается, когда её двигают. */
  clip?: boolean;
}

/** Содержимое записи хранится ссылкой: поправили текст или песню — лист это увидит. */
export type SheetContent =
  | { kind: 'photo'; photoId: string; caption?: string }
  | { kind: 'tape'; photoId: string }
  | { kind: 'text' | 'date' | 'mood' | 'weather' }
  | { kind: 'ticket'; carrier?: MusicCarrier }
  | { kind: 'sticker'; motif: string }
  | { kind: 'label'; text: string }
  | { kind: 'image'; asset: string };

export type SheetItem = SheetContent &
  Rect & {
    id: string;
    leaf: SheetLeaf;
    rotation: number;
    scale: number;
    color: string;
    /** Материал вклейки (тень). Порядок наложения задаёт место в списке. */
    layer: number;
    /** Когда появляется при сборке под песню: 0 — сначала, 1 — в конце. */
    at: number;
    look?: PieceLook;
  };

export interface LeafPaper {
  /** 'textures/cream', 'papers/marble', 'photo:<id>' или 'none'. */
  texture?: string;
  color?: string;
  strength?: number;
  zoom?: number;
  ruling?: Ruling;
  line?: string;
  /** Тёмная бумага: записи пишутся светлыми чернилами. */
  dark?: boolean;
}

export interface SheetScene {
  color?: string;
  texture?: string;
  dim?: number;
  blur?: number;
  glow?: string;
  glowPower?: number;
  /** Светлый фон: надписи экрана тёмные. */
  light?: boolean;
  stars?: boolean;
  sparks?: boolean;
  orbits?: boolean;
}

export interface LeafBase {
  stock: PaperStock;
  sheet: string;
}

export interface SheetDesign {
  v: 1;
  /**
   * Пока автор только добавляет своё, здесь лишь добавленное и раскладку ведут правила.
   * Когда тронута их вклейка, здесь весь лист, а frozen помнит его основу.
   */
  items: SheetItem[];
  frozen?: {
    /** Что из записи уже бывало на листе: удалённое автором само не возвращается. */
    seen: string[];
    leaves: Record<SheetLeaf, LeafBase>;
    emphasis: boolean;
  };
  paper?: Partial<Record<SheetLeaf, LeafPaper>>;
  scene?: SheetScene;
  spiral?: SpiralLook;
  marker?: string;
}

/** То, что нужно отрисовке от правок, кроме самих вклеек. */
export interface SheetFinish {
  leaves: Record<SheetLeaf, LeafBase>;
  emphasis: boolean;
  paper: Partial<Record<SheetLeaf, LeafPaper>>;
  scene: SheetScene;
  spiral: SpiralLook;
}
