import { useEffect, useRef, type RefObject } from 'react';

export interface FieldMotion {
  /** Сдвиг на перевороте листа, −1..1: ближние частицы пролетают сильнее дальних. */
  pan: number;
}

interface Star {
  x: number;
  y: number;
  /** Глубина 0 — далеко, 1 — у самой камеры. */
  z: number;
  phase: number;
  tinted: boolean;
}

/** Детерминированный генератор: поле одинаковое при каждом открытии. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sprite(color: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  const hex = String(ctx.fillStyle);
  const n = parseInt(hex.slice(1), 16);
  const rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, `rgba(${rgb},1)`);
  g.addColorStop(0.18, `rgba(${rgb},0.85)`);
  g.addColorStop(0.45, `rgba(${rgb},0.22)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

/**
 * Пыль в луче света на Canvas2D: дальние точки мелкие и тусклые, ближние — крупные мягкие
 * пятна не в фокусе. Каждая седьмая точка — в цвет дня.
 */
export function Starfield({
  color,
  motion,
  fall = null,
  energy = 0.5,
}: {
  color: string;
  motion: RefObject<FieldMotion>;
  /** Погода часа записи: снег и дождь падают, без осадков в свете лампы плавает пыль. */
  fall?: 'snow' | 'rain' | null;
  /** Энергия песни 0..1: громкий день — частицы быстрее. */
  energy?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const tint = useRef(color);
  tint.current = color;
  const weather = useRef({ fall, energy });
  weather.current = { fall, energy };

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const random = mulberry32(20261120);
    const stars: Star[] = Array.from({ length: 150 }, (_, i) => ({
      x: random(),
      y: random(),
      z: random() ** 1.8,
      phase: random() * Math.PI * 2,
      tinted: i % 7 === 0,
    }));
    const white = sprite('#ffffff');
    let colored = sprite(tint.current);
    let lastTint = tint.current;
    let w = 0;
    let h = 0;
    let frame = 0;
    let last = performance.now();
    let pan = 0;
    const calm = matchMedia('(prefers-reduced-motion: reduce)');

    const resize = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      if (tint.current !== lastTint) {
        lastTint = tint.current;
        colored = sprite(lastTint);
      }
      pan += ((motion.current?.pan ?? 0) - pan) * 0.22;
      ctx.clearRect(0, 0, w, h);
      const { fall, energy } = weather.current;
      const pace = 0.7 + energy * 0.8;
      for (const s of stars) {
        if (!calm.matches) {
          if (fall === 'snow') s.y += dt * (0.000035 + s.z * 0.00008) * pace;
          else if (fall === 'rain') s.y += dt * (0.0007 + s.z * 0.0011) * pace;
          else s.y -= dt * (0.000006 + s.z * 0.00003) * pace;
          if (s.y < -0.06 || s.y > 1.06) {
            s.y = s.y < 0 ? 1.06 : -0.06;
            s.x = Math.random();
          }
        }
        const span = w + 80;
        const sway = fall === 'snow' ? Math.sin(now * 0.0007 + s.phase) * (6 + s.z * 18) : 0;
        const x = ((((s.x * span - pan * (24 + s.z * 320) + sway) % span) + span) % span) - 40;
        const y = s.y * h;
        if (fall === 'rain') {
          // Капли — тонкие косые штрихи, ближние длиннее и светлее.
          const len = 8 + s.z * 26;
          ctx.globalAlpha = 0.12 + s.z * 0.35;
          ctx.strokeStyle = '#d9e4f2';
          ctx.lineWidth = 0.6 + s.z * 1.2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - len * 0.18, y + len);
          ctx.stroke();
          continue;
        }
        const size = (fall === 'snow' ? 1.6 : 0.9) + s.z * s.z * (fall === 'snow' ? 9 : 13);
        const twinkle = calm.matches ? 0.8 : 0.62 + 0.38 * Math.sin(now * 0.0016 + s.phase);
        // Ближние частицы не в фокусе: крупнее и прозрачнее.
        ctx.globalAlpha = twinkle * (s.z > 0.75 ? 0.28 : 0.35 + s.z * 0.65);
        ctx.drawImage(s.tinted ? colored : white, x - size, y - size, size * 2, size * 2);
      }
      ctx.globalAlpha = 1;
      if (!calm.matches && !document.hidden) frame = requestAnimationFrame(draw);
    };

    const restart = () => {
      cancelAnimationFrame(frame);
      last = performance.now();
      frame = requestAnimationFrame(draw);
    };
    const watch = new ResizeObserver(() => {
      resize();
      if (calm.matches) restart();
    });
    watch.observe(el);
    resize();
    restart();
    document.addEventListener('visibilitychange', restart);
    calm.addEventListener('change', restart);
    return () => {
      cancelAnimationFrame(frame);
      watch.disconnect();
      document.removeEventListener('visibilitychange', restart);
      calm.removeEventListener('change', restart);
    };
  }, [motion]);

  return <canvas className="g-stars" ref={canvas} aria-hidden="true" />;
}
