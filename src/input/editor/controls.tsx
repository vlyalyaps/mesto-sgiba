import { useId, type ReactNode } from 'react';

const paths = {
  undo: 'M8 5 3.5 9.5 8 14M4 9.5h8a4.5 4.5 0 0 1 0 9H9',
  redo: 'M14 5l4.5 4.5L14 14M18 9.5h-8a4.5 4.5 0 0 0 0 9h3',
  close: 'm6 6 10 10M16 6 6 16',
  minus: 'M6 11h10',
  plus: 'M6 11h10M11 6v10',
  play: 'M8 5.5v11l8.5-5.5z',
  stop: 'M7 7h8v8H7z',
  replay: 'M17 11a6 6 0 1 1-1.8-4.3M17 3.5v4h-4',
  magnet: 'M6 4v7a5 5 0 0 0 10 0V4h-3v7a2 2 0 0 1-4 0V4zM6 7h3M13 7h3',
  copy: 'M8 8h10v10H8zM4 14V4h10',
  trash: 'M4 6h14M9 6V4h4v2M6.5 6l1 12h7l1-12M9.5 10v5M12.5 10v5',
  flip: 'M11 3v16M8 6v10H3zM14 6v10h5z',
  top: 'M4 4h14M11 18V8M7 11l4-4 4 4',
  up: 'M11 17V6M7 10l4-4 4 4',
  down: 'M11 5v11M7 12l4 4 4-4',
  bottom: 'M4 18h14M11 4v10M7 11l4 4 4-4',
  day: 'M4 18l1-4L14.5 4.5l3 3L8 17zM12.5 6.5l3 3M11 18h7',
  paper: 'M5 3h9l3 3v13H5zM14 3v4h3M8 11h6M8 14h6',
  scene: 'M3 4h16v14H3zM3 15l5-5 4 4 3-3 4 4',
  photo: 'M3 6h4l2-2h4l2 2h4v12H3zM11 15a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
  text: 'M5 7V4h12v3M11 4v14M8 18h6',
  stickers: 'M18 11a7 7 0 1 0-7 7zM11 18c0-4 3-7 7-7',
  music:
    'M8 16V5l10-2v11M8 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM18 14a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  layers: 'm11 3 8 4-8 4-8-4zM3 11l8 4 8-4M3 15l8 4 8-4',
  centerX: 'M11 3v16M6 7h10v3H6zM7.5 13h7v3h-7z',
  centerY: 'M3 11h16M7 6h3v10H7zM13 7.5h3v7h-3z',
};
export type IconName = keyof typeof paths;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="ed-icon" viewBox="0 0 22 22" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

export function IconButton({
  name,
  label,
  onClick,
  disabled,
  pressed,
  className = '',
}: {
  name: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`ed-iconbtn ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
    >
      <Icon name={name} />
    </button>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ed-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  show = (v) => `${Math.round(v * 100)}%`,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  show?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="ed-slider">
      <label htmlFor={id}>{label}</label>
      <output htmlFor={id}>{show(value)}</output>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
  className = '',
}: {
  label: string;
  options: readonly { id: T; title: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={`ed-chips ${className}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className="ed-chip"
          aria-pressed={option.id === value}
          onClick={() => onChange(option.id)}
        >
          {option.title}
        </button>
      ))}
    </div>
  );
}

const INKS = [
  '#17181a',
  '#263653',
  '#3a5069',
  '#354f46',
  '#8b3d2c',
  '#c0392f',
  '#e07a2f',
  '#edc74b',
  '#8fae7c',
  '#86b7d8',
  '#b98ac4',
  '#e9a5b4',
  '#f6ecd2',
  '#ffffff',
];

export function Swatches({
  label,
  value,
  onChange,
  palette = [],
  reset = 'Как у правил',
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  /** Цвета снимков идут первыми. */
  palette?: string[];
  reset?: string;
}) {
  const colors = [...new Set([...palette, ...INKS].map((color) => color.toLowerCase()))];
  const now = value?.toLowerCase();
  return (
    <div className="ed-swatches" role="group" aria-label={label}>
      <button
        type="button"
        className="ed-swatch ed-swatch-none"
        aria-pressed={!value}
        aria-label={`${label}: ${reset.toLowerCase()}`}
        title={reset}
        onClick={() => onChange(undefined)}
      />
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className="ed-swatch"
          style={{ backgroundColor: color }}
          aria-pressed={now === color}
          aria-label={`${label}: ${color}`}
          title={color}
          onClick={() => onChange(color)}
        />
      ))}
      <label className="ed-swatch ed-swatch-any" title="Любой цвет">
        <input
          type="color"
          value={now ?? '#263653'}
          aria-label={`${label}: любой цвет`}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}
