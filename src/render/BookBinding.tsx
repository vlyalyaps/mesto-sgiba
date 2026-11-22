import type { CSSProperties, ReactNode, Ref } from 'react';
import type { PaperStock } from '../types/dayspec';

function bindingClass(month: string) {
  return 'binding-' + (Number(month.slice(-2)) % 3);
}

export function BookBinding({
  month,
  children,
  ref,
  assembling,
}: {
  month: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
  /** Кусочки ещё ложатся на лист. */
  assembling?: boolean;
}) {
  return (
    <div
      ref={ref}
      className={`day-spread ${bindingClass(month)}`}
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
}: {
  side: 'left' | 'right';
  stock: PaperStock;
  marker?: string;
  children: ReactNode;
  className?: string;
  label: string;
  /** Бумага, которую выбрал автор. */
  dress?: { data: Record<string, string | undefined>; style: object };
}) {
  const paper = {
    '--stock': `url("${import.meta.env.BASE_URL}textures/${stock}.webp")`,
    '--paper-color': paperColors[stock],
    '--marker': marker,
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
