import type { CSSProperties, ReactNode, Ref } from 'react';
import type { PaperStock } from '../types/dayspec';

export function bindingClass(month: string) {
  return 'binding-' + (Number(month.slice(-2)) % 3);
}

export function BookBinding({
  month,
  children,
  contents = false,
  ref,
  assembling,
}: {
  month: string;
  children: ReactNode;
  contents?: boolean;
  ref?: Ref<HTMLDivElement>;
  /** Кусочки ещё ложатся на лист. */
  assembling?: boolean;
}) {
  return (
    <div
      ref={ref}
      className={`day-spread ${bindingClass(month)}${contents ? ' binding-contents' : ''}`}
      data-assembling={assembling || undefined}
    >
      {children}
    </div>
  );
}

const paperColors: Record<PaperStock, string> = {
  cream: '#ebdbb7',
  white: '#ede7d8',
  aged: '#dac093',
  kraft: '#c5a275',
};

export function BookLeaf({
  side,
  stock,
  marker,
  children,
  className = '',
  label,
  dress,
  veil,
}: {
  side: 'left' | 'right';
  stock: PaperStock;
  marker?: string;
  children: ReactNode;
  className?: string;
  label: string;
  /** Бумага, которую выбрал автор. */
  dress?: { data: Record<string, string | undefined>; style: object };
  /** Холодная вуаль поверх листа (paper.tone и paper.brightness). */
  veil?: string;
}) {
  const paper = {
    '--stock': `url("${import.meta.env.BASE_URL}textures/${stock}.webp")`,
    '--paper-color': paperColors[stock],
    '--marker': marker,
    '--veil': veil,
    ...dress?.style,
  } as CSSProperties;
  return (
    <section
      {...dress?.data}
      className={`journal-leaf leaf-${side} ${className}`}
      data-stock={stock}
      aria-label={label}
      style={paper}
    >
      {children}
    </section>
  );
}

/**
 * Тон и яркость бумаги из правил — полупрозрачная сине-серая вуаль поверх листа:
 * холодная бумага синеет, тёмная сереет. Тёплая и светлая бумага остаётся как есть.
 */
export function paperVeil(paper: { spreadTone: number; brightness: number }) {
  const chill = Math.max(0, -paper.spreadTone);
  const dim = Math.max(0, 0.55 - paper.brightness);
  const alpha = Math.min(0.34, chill * 0.24 + dim * 0.5);
  return alpha < 0.02 ? undefined : `rgb(30 46 74 / ${alpha.toFixed(3)})`;
}
