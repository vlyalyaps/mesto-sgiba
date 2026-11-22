import type { CSSProperties, ReactNode } from 'react';
import type { PaperStock } from '../types/dayspec';

export function bindingClass(month: string) {
  return 'binding-' + (Number(month.slice(-2)) % 3);
}

export function BookBinding({
  month,
  children,
  contents = false,
}: {
  month: string;
  children: ReactNode;
  contents?: boolean;
}) {
  return (
    <div className={`day-spread ${bindingClass(month)}${contents ? ' binding-contents' : ''}`}>
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
}: {
  side: 'left' | 'right';
  stock: PaperStock;
  marker?: string;
  children: ReactNode;
  className?: string;
  label: string;
}) {
  const paper = {
    '--stock': `url("${import.meta.env.BASE_URL}textures/${stock}.webp")`,
    '--paper-color': paperColors[stock],
    '--marker': marker,
  } as CSSProperties;
  return (
    <section
      className={`journal-leaf leaf-${side} ${className}`}
      data-stock={stock}
      aria-label={label}
      style={paper}
    >
      {children}
    </section>
  );
}
