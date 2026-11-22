/** Правки автора → атрибуты и переменные, которые читает sheet.css. */
import type { CSSProperties } from 'react';
import type { CutAlphabet, DaySpec, PageElement } from '../types/dayspec';
import type { ImageTone, SheetFont, SheetLeaf } from '../types/sheet';
import { textureUrl } from './assets';

type TypeFont = Exclude<SheetFont, `cut-${CutAlphabet}`>;

export const typeFonts: Record<
  TypeFont,
  { title: string; family: string; weight: number; italic?: boolean }
> = {
  caveat: { title: 'Caveat', family: 'Caveat, cursive', weight: 400 },
  'caveat-bold': { title: 'Caveat жирный', family: 'Caveat, cursive', weight: 700 },
  neucha: { title: 'Neucha', family: 'Neucha, cursive', weight: 400 },
  literata: { title: 'Literata', family: "'Literata Variable', Georgia, serif", weight: 400 },
  'literata-italic': {
    title: 'Literata курсив',
    family: "'Literata Variable', Georgia, serif",
    weight: 450,
    italic: true,
  },
  'literata-bold': {
    title: 'Literata жирный',
    family: "'Literata Variable', Georgia, serif",
    weight: 800,
  },
  golos: { title: 'Golos', family: "'Golos Text Variable', sans-serif", weight: 400 },
  'golos-black': {
    title: 'Golos чёрный',
    family: "'Golos Text Variable', sans-serif",
    weight: 900,
  },
  mono: { title: 'Plex Mono', family: "'IBM Plex Mono', monospace", weight: 500 },
};

export function cutFont(font: SheetFont | undefined): CutAlphabet | null {
  return font?.startsWith('cut-') ? (font.slice(4) as CutAlphabet) : null;
}

export function fontStyle(font: SheetFont | undefined): CSSProperties {
  if (!font || cutFont(font)) return {};
  const { family, weight, italic } = typeFonts[font as TypeFont];
  return { fontFamily: family, fontWeight: weight, fontStyle: italic ? 'italic' : 'normal' };
}

export const toneFilters: Record<ImageTone, string> = {
  bw: 'grayscale(1) contrast(1.08)',
  sepia: 'sepia(0.75) contrast(0.95)',
  warm: 'sepia(0.28) saturate(1.3) brightness(1.04)',
  cool: 'saturate(0.8) hue-rotate(14deg) brightness(1.02)',
  faded: 'saturate(0.55) contrast(0.78) brightness(1.12)',
  punchy: 'saturate(1.5) contrast(1.2)',
};

interface Dressing {
  data: Record<string, string | undefined>;
  style: Record<string, string | number | undefined>;
}

const percent = (n: number) => `${(n * 100).toFixed(3)}%`;

export function pieceDressing(e: PageElement, spec: DaySpec): Dressing {
  const data: Dressing['data'] = {};
  const style: Dressing['style'] = {};
  const look = e.look;
  if (!look) return { data, style };
  if (look.opacity !== undefined) {
    data['data-opacity'] = '';
    style['--piece-opacity'] = look.opacity;
  }
  if (look.color) {
    data['data-color'] = '';
    style['--piece-color'] = look.color;
  }
  if (look.fill) {
    data['data-fill'] = '';
    style['--piece-fill'] = look.fill;
  }
  if (look.font && !cutFont(look.font)) {
    const font = typeFonts[look.font as TypeFont];
    data['data-font'] = '';
    style['--piece-font'] = font.family;
    style['--piece-weight'] = font.weight;
    style['--piece-slant'] = font.italic ? 'italic' : 'normal';
  }
  if (look.size !== undefined) {
    data['data-size'] = '';
    style['--piece-size'] = `${look.size}cqw`;
  }
  if (look.align) data['data-align'] = look.align;
  if (look.upper) data['data-upper'] = '';
  if (look.lineHeight !== undefined) {
    data['data-leading'] = '';
    style['--piece-leading'] = look.lineHeight;
  }
  if (look.spacing !== undefined) {
    data['data-spacing'] = '';
    style['--piece-spacing'] = `${look.spacing}em`;
  }
  if (look.blend) style.mixBlendMode = look.blend;
  if (look.shadow !== undefined) {
    data['data-shadow'] = '';
    const s = look.shadow;
    style['--piece-shadow'] =
      s === 0
        ? 'none'
        : `drop-shadow(${s * 3}px ${1 + s * 7}px ${1 + s * 9}px rgb(45 28 18 / ${0.18 + s * 0.35}))`;
  }
  const filters = [
    look.tone && toneFilters[look.tone],
    look.brightness !== undefined && `brightness(${look.brightness})`,
    look.contrast !== undefined && `contrast(${look.contrast})`,
    look.saturation !== undefined && `saturate(${look.saturation})`,
    look.hue !== undefined && `hue-rotate(${look.hue}deg)`,
  ].filter(Boolean);
  if (filters.length) {
    data['data-filter'] = '';
    style['--piece-filter'] = filters.join(' ');
  }
  if (e.kind === 'photo') {
    if (look.frame && look.frame !== 'plain') data['data-frame'] = look.frame;
    const zoom = look.zoom ?? 1;
    if (look.pan || zoom > 1) {
      const crop = spec.photos.find((p) => p.photoId === e.photoId)?.crop;
      const x = look.pan?.x ?? (crop ? crop.x + crop.w / 2 : 0.5);
      const y = look.pan?.y ?? (crop ? crop.y + crop.h / 2 : 0.5);
      data['data-crop'] = '';
      style['--crop-at'] = `${percent(x)} ${percent(y)}`;
      style['--crop-zoom'] = zoom;
      // Обрез считается до увеличения: видимое окно остаётся размером с отпечаток.
      const spare = 1 - 1 / zoom;
      style['--crop-clip'] =
        zoom > 1
          ? `inset(${percent(y * spare)} ${percent((1 - x) * spare)} ${percent((1 - y) * spare)} ${percent(x * spare)})`
          : 'none';
    }
  }
  return { data, style };
}

function tint(color: string, strength: number): string {
  const n = parseInt(color.slice(1), 16);
  const part = (shift: number) => {
    const v = (n >> shift) & 255;
    return Math.round(255 + (v - 255) * strength);
  };
  return `rgb(${part(16)} ${part(8)} ${part(0)})`;
}

export function leafDressing(spec: DaySpec, leaf: SheetLeaf): Dressing {
  const data: Dressing['data'] = {};
  const style: Dressing['style'] = {};
  const sheet = spec.page.sheet;
  if (!sheet) return { data, style };
  data['data-designed'] = '';
  if (sheet.spiral !== 'metal') data['data-spiral'] = sheet.spiral;
  const paper = sheet.paper[leaf];
  if (!paper) return { data, style };
  if (paper.ruling) data['data-ruling'] = paper.ruling;
  if (paper.line) style['--rule-ink'] = paper.line;
  if (paper.dark) data['data-dark'] = '';
  if (paper.texture || paper.color) {
    const url = textureUrl(paper.texture ?? `textures/${sheet.leaves[leaf].stock}`, spec.photos);
    data['data-paper'] = '';
    style['--sheet-color'] = url ? '#fff' : (paper.color ?? (paper.dark ? '#202020' : '#f1eadc'));
    if (url) {
      style['--sheet-texture'] = `url("${url}")`;
      if (paper.color) {
        const mixed = tint(paper.color, paper.strength ?? 0.6);
        style['--sheet-tint'] = `linear-gradient(${mixed}, ${mixed})`;
      }
      if (paper.zoom !== undefined) style['--sheet-size'] = `${paper.zoom * 100}% auto`;
    }
  }
  return { data, style };
}
