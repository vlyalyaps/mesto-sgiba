import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPlayer, type Player } from '../audio/player';
import { refreshPreview } from '../audio/itunes';
import type { DaySpec } from '../types/dayspec';
import { Cover, photoLook } from './Cover';
import { formatDate } from './format';
import {
  COVER_W,
  SPREAD_W,
  anglesAt,
  beatProgress,
  beatPulse,
  beatSchedule,
  chainExtent,
  fitFont,
  focusRegion,
  layoutSpread,
  lerp,
  openAngles,
  panelT,
  planBook,
  regionCenter,
  revealWindow,
  steppedProgress,
  stepsDuration,
  type BeatStep,
  type PanelPlan,
} from './geometry';
import { readableInk, shadeStrength, toneColor } from './paper';
import { Photo } from './Photo';
import { project, springStep } from './spring';
import { causeMarks, markText, songThread } from './thread';
import './book.css';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const rad = (d: number) => (d * Math.PI) / 180;
/** Зазор между сложенными листами по глубине, px: без него плоскости мерцают. */
const Z_GAP = 1;
const FOLD_POS = [0.22, 0.7, 0.4, 0.85, 0.55, 0.15];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

type Sound = 'off' | 'loading' | 'playing';

/** Книжка-гармошка: закрытая обложка, раскрытие по нажатию, звук, оборот «Почему так». */
export function Book({ spec }: { spec: DaySpec }) {
  const reduced = usePrefersReducedMotion();
  const plan = useMemo(() => planBook(spec), [spec]);
  const thread = useMemo(() => {
    const pk = spec.reveal.peakSec;
    if (pk === null) return null;
    return songThread(plan, spec, revealWindow(spec.reveal.durationMs, pk, spec.reveal.prerollSec));
  }, [plan, spec]);
  const marks = useMemo(() => causeMarks(spec.why), [spec.why]);
  const rightIndex = plan.findIndex((q) => q.side === 'R');
  // На поля разворота — две причины: сначала из главной фразы, потом из складок.
  const notes = useMemo(() => {
    const key = spec.key.text.toLowerCase();
    const all = [key, ...spec.folds.map((f) => f.text.toLowerCase())].join(' ');
    return [...marks.entries()]
      .filter(([w]) => all.includes(w))
      .sort(
        (a, b) =>
          Number(key.includes(b[0])) - Number(key.includes(a[0])) ||
          all.indexOf(a[0]) - all.indexOf(b[0]),
      )
      .slice(0, 2);
  }, [marks, spec.key.text, spec.folds]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const chainRef = useRef<HTMLDivElement>(null);
  const floorRef = useRef<HTMLSpanElement>(null);
  const stackRef = useRef<HTMLSpanElement>(null);
  const pnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const faceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shadeRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const progress = useRef(0);
  const cancelMotion = useRef<(() => void) | null>(null);
  const playerRef = useRef<Player | null>(null);
  const previewRef = useRef<string | null>(spec.song?.previewUrl ?? null);
  const run = useRef(0);
  /** Толчок на доле после пика, доля масштаба. */
  const breath = useRef(0);
  const drag = useRef<{
    x: number;
    p0: number;
    moved: boolean;
    trail: { t: number; p: number }[];
  } | null>(null);
  const dragged = useRef(false);
  const mounted = useRef(true);

  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [sound, setSound] = useState<Sound>('off');
  const [notice, setNotice] = useState<string | null>(null);

  // ---------- Размеры ----------
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const openExt = useMemo(() => chainExtent(plan, openAngles(plan)), [plan]);
  const openUnits = openExt.max - openExt.min;
  const W = width || 340;
  const fit = (W * 0.96) / openUnits;
  const lo = Math.min(W / (SPREAD_W + 0.08), 300);
  const H = Math.round(clamp(fit, lo, 420));
  const scrollMode = openUnits * H > W * 0.98;
  const pad = Math.max(12, (W - COVER_W * H) / 2);
  const sceneW = scrollMode ? Math.round(openUnits * H + 2 * pad) : W;
  const halfIndex = plan.findIndex((q) => q.side === 'L');

  const strength = shadeStrength(spec.paper.shadow);
  const margin = H * (0.025 + 0.06 * spec.paper.margin);
  const foldPaper = toneColor(spec.paper.tone, spec.paper.brightness, spec.paper.age);
  const spreadPaper = toneColor(spec.paper.spreadTone, spec.paper.brightness, spec.paper.age);

  // ---------- Применение прогресса раскрытия ----------
  const apply = useCallback(
    (p: number, scroll: boolean) => {
      const n = plan.length;
      const A = anglesAt(plan, p);
      let prev = 0;
      plan.forEach((q, i) => {
        const pn = pnRefs.current[i];
        if (!pn) return;
        pn.style.transform = `rotateY(${(A[i] - prev).toFixed(2)}deg)`;
        prev = A[i];
        const face = faceRefs.current[i];
        if (face) {
          const dz = i === 0 ? 0 : -i * Z_GAP * Math.cos(rad(q.closedA)) * (1 - panelT(i, n, p));
          face.style.transform = dz ? `translateZ(${dz.toFixed(2)}px)` : '';
          // Листы разной ширины в сложенном виде торчали бы из-под обложки: закрытой
          // книжка видна только обложкой и обрезом, листы проступают с первых градусов.
          if (i > 0) face.style.opacity = clamp(p * 9, 0, 1).toFixed(3);
        }
        const shade = shadeRefs.current[i];
        if (shade) shade.style.opacity = Math.abs(Math.sin(rad(A[i]))).toFixed(3);
      });
      if (stackRef.current) stackRef.current.style.opacity = String(clamp(1 - p * 3, 0, 1));

      const ext = chainExtent(plan, A);
      const center = (ext.min + ext.max) / 2;
      const origin = scrollMode ? pad - openExt.min * H : W / 2 - center * H;
      const chain = chainRef.current;
      if (chain) {
        const b = breath.current;
        chain.style.transform =
          `translateX(${origin.toFixed(1)}px)` + (b ? ` scale(${(1 + b).toFixed(4)})` : '');
        // Главная фраза проявляется на последних долях, как краска на отпечатке.
        const ink = clamp((p - 0.78) / 0.22, 0, 1);
        chain.style.setProperty('--ink-in', (1 - Math.pow(1 - ink, 2)).toFixed(3));
      }
      if (floorRef.current) {
        const w = Math.max(40, (ext.max - ext.min) * H * 1.06);
        const cx = origin + center * H;
        floorRef.current.style.transform = `translateX(${(cx - sceneW / 2).toFixed(1)}px) scaleX(${(w / sceneW).toFixed(3)})`;
      }
      const sc = scrollRef.current;
      if (sc && scrollMode) {
        const gutter = halfIndex >= 0 ? openExt.ends[halfIndex] : openExt.max / 2;
        const target = clamp(
          pad - openExt.min * H + gutter * H - W / 2,
          0,
          Math.max(0, sceneW - W),
        );
        if (scroll) sc.scrollLeft = lerp(0, target, p);
        if (sceneRef.current)
          sceneRef.current.style.perspectiveOrigin = `${sc.scrollLeft + W / 2}px 35%`;
      } else if (sceneRef.current) {
        sceneRef.current.style.perspectiveOrigin = '50% 35%';
      }
    },
    [plan, H, W, pad, sceneW, scrollMode, openExt, halfIndex],
  );

  useLayoutEffect(() => {
    apply(progress.current, !cancelMotion.current);
  }, [apply]);

  const onScroll = () => {
    const sc = scrollRef.current;
    if (sc && scrollMode && sceneRef.current) {
      sceneRef.current.style.perspectiveOrigin = `${sc.scrollLeft + W / 2}px 35%`;
    }
  };

  // ---------- Движение ----------
  const cancel = useCallback(() => {
    cancelMotion.current?.();
    cancelMotion.current = null;
  }, []);

  const setProgress = useCallback(
    (p: number) => {
      progress.current = p;
      apply(p, true);
    },
    [apply],
  );

  /** Мягкое появление вместо раскачки при prefers-reduced-motion. */
  const fadeIn = useCallback(() => {
    chainRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 320,
      easing: 'ease-out',
    });
  }, []);

  const animateTo = useCallback(
    (to: number, ms: number, steps?: BeatStep[]) => {
      cancel();
      if (reduced || ms <= 0) {
        setProgress(to);
        if (reduced) fadeIn();
        return;
      }
      const from = progress.current;
      const total = steps?.length ? stepsDuration(steps) : ms;
      const t0 = performance.now();
      let raf = 0;
      const tick = (now: number) => {
        const t = now - t0;
        let p: number;
        if (steps?.length) p = steppedProgress(steps, t);
        else {
          const k = clamp(t / total, 0, 1);
          p = lerp(from, to, k);
        }
        setProgress(p);
        if (t < total) raf = requestAnimationFrame(tick);
        else {
          setProgress(to);
          cancelMotion.current = null;
        }
      };
      raf = requestAnimationFrame(tick);
      cancelMotion.current = () => cancelAnimationFrame(raf);
    },
    [cancel, reduced, setProgress, fadeIn],
  );

  /**
   * Пружина от текущего положения: её можно перехватить рукой в любой момент,
   * а скорость жеста переходит в движение без шва.
   */
  const animateSpring = useCallback(
    (to: number, v0 = 0, response = 0.45, damping = 1) => {
      cancel();
      if (reduced) {
        setProgress(to);
        fadeIn();
        return;
      }
      let x = progress.current;
      let v = v0;
      let last = performance.now();
      let raf = 0;
      const tick = (now: number) => {
        let dt = Math.min(0.064, (now - last) / 1000);
        last = now;
        while (dt > 0) {
          const h = Math.min(dt, 1 / 120);
          [x, v] = springStep(x, v, to, h, response, damping);
          dt -= h;
        }
        const done = Math.abs(x - to) < 0.0015 && Math.abs(v) < 0.02;
        setProgress(done ? to : x);
        if (!done) raf = requestAnimationFrame(tick);
        else cancelMotion.current = null;
      };
      raf = requestAnimationFrame(tick);
      cancelMotion.current = () => cancelAnimationFrame(raf);
    },
    [cancel, reduced, setProgress, fadeIn],
  );

  const stopSound = useCallback(() => {
    playerRef.current?.stop();
    chainRef.current?.style.removeProperty('--ph');
    if (mounted.current) setSound('off');
  }, []);

  const openSilent = useCallback(() => {
    run.current++;
    setOpen(true);
    const ms = clamp(spec.reveal.durationMs, 600, 3500);
    const steps = beatSchedule(spec.reveal.beats, ms);
    if (steps.length) animateTo(1, ms, steps);
    else animateSpring(1, 0, 0.7, 1);
  }, [animateTo, animateSpring, spec.reveal]);

  const close = useCallback(() => {
    run.current++;
    cancel();
    stopSound();
    setOpen(false);
    setNotice(null);
    animateSpring(0, 0, 0.42, 1);
  }, [animateSpring, cancel, stopSound]);

  const openWithSound = useCallback(async () => {
    const song = spec.song;
    if (!song?.trackId) return;
    const id = ++run.current;
    cancel();
    setNotice(null);
    setOpen(false);
    setProgress(0);
    setSound('loading');
    const alive = () => mounted.current && run.current === id;
    const silent = (why: string) => {
      if (!mounted.current) return;
      setSound('off');
      setNotice(why);
      openSilent();
    };

    let url = previewRef.current;
    if (!url) {
      url = await refreshPreview(song.trackId);
      previewRef.current = url;
    }
    if (!alive()) return;
    if (!url) return silent('Фрагмент песни сейчас недоступен, раскрываю без звука.');

    const peak = spec.reveal.peakSec ?? spec.reveal.prerollSec + spec.reveal.durationMs / 1000;
    const start = Math.max(0, peak - spec.reveal.prerollSec);
    const win = revealWindow(spec.reveal.durationMs, peak, spec.reveal.prerollSec);
    const player = (playerRef.current ??= createPlayer());
    try {
      await player.play(url, start);
    } catch {
      if (!alive()) return;
      return silent('Браузер не дал включить звук, раскрываю без него.');
    }
    if (!alive()) {
      player.stop();
      return;
    }
    setSound('playing');
    setOpen(true);
    const off = player.onEnded(() => {
      off();
      if (mounted.current) setSound('off');
    });

    if (reduced) {
      setProgress(1);
      fadeIn();
      return;
    }
    let raf = 0;
    const tick = () => {
      if (!alive()) return;
      const c = player.currentTime();
      if (c === null) {
        // Фрагмент кончился или его остановили: докрываем без звука и перестаём дышать.
        breath.current = 0;
        chainRef.current?.style.removeProperty('--ph');
        cancelMotion.current = null;
        animateTo(1, progress.current < 1 ? 600 : 0);
        return;
      }
      const p = beatProgress(c, peak, win, spec.reveal.beats);
      if (thread && chainRef.current) {
        const ph = (thread.gutter + (c - thread.peakSec) * thread.perSec) * H;
        chainRef.current.style.setProperty('--ph', `${ph.toFixed(1)}px`);
      }
      breath.current =
        p >= 1 ? beatPulse(c, spec.reveal.beats, peak, 0.003 + 0.005 * spec.rhythm.density) : 0;
      setProgress(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    cancelMotion.current = () => cancelAnimationFrame(raf);
  }, [spec, cancel, setProgress, openSilent, animateTo, reduced, fadeIn, thread, H]);

  useEffect(() => {
    if (!whyOpen) return;
    document
      .getElementById('book-why')
      ?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [whyOpen, reduced]);

  const toggle = () => (open ? close() : openSilent());

  // Книжку можно раскрыть рукой: потянуть край вправо, сложить — влево.
  const canDrag = !(scrollMode && open);
  const onPointerDown = (e: ReactPointerEvent) => {
    if (!canDrag || e.button !== 0) return;
    drag.current = { x: e.clientX, p0: progress.current, moved: false, trail: [] };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved) {
      if (Math.abs(dx) < 8) return;
      d.moved = true;
      run.current++;
      cancel();
      stopSound();
      breath.current = 0;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const p = clamp(d.p0 + dx / (W * 0.6), 0, 1);
    d.trail.push({ t: e.timeStamp, p });
    if (d.trail.length > 6) d.trail.shift();
    setProgress(p);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    dragged.current = true;
    // Скорость жеста по последним ~100 мс: решает не положение, а куда летит рука.
    const tr = d.trail;
    const lastPt = tr[tr.length - 1];
    const firstPt = tr.find((s) => lastPt && lastPt.t - s.t <= 100) ?? lastPt;
    const dt = lastPt && firstPt ? (lastPt.t - firstPt.t) / 1000 : 0;
    const v = dt > 0.008 ? (lastPt.p - firstPt.p) / dt : 0;
    const to = progress.current + project(v) > 0.5 ? 1 : 0;
    setOpen(to === 1);
    setNotice(null);
    animateSpring(to, v, 0.42, Math.abs(v) > 1.5 ? 0.85 : 1);
  };
  const onSceneClick = () => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    toggle();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  };

  // Ссылка на фрагмент живёт недолго: заранее спрашиваем свежую, звук при этом не включается.
  useEffect(() => {
    const id = spec.song?.trackId;
    if (!id || previewRef.current) return;
    const ctl = new AbortController();
    refreshPreview(id, ctl.signal)
      .then((u) => {
        previewRef.current ??= u;
      })
      .catch(() => undefined);
    return () => ctl.abort();
  }, [spec.song?.trackId]);

  useEffect(() => {
    mounted.current = true;
    const hide = () => playerRef.current?.stop();
    window.addEventListener('pagehide', hide);
    return () => {
      mounted.current = false;
      run.current++;
      window.removeEventListener('pagehide', hide);
      cancelMotion.current?.();
      playerRef.current?.stop();
    };
  }, []);

  // ---------- Лист ----------
  const keySlot = Math.max(
    0,
    spec.photos.findIndex((p) => p.role === 'key'),
  );
  const look = photoLook(spec);
  const pool = useMemo(() => {
    const support = spec.photos.filter((p) => p.role !== 'key');
    return support.length ? support : spec.photos;
  }, [spec.photos]);
  const inkFold = readableInk(spec.ink, foldPaper);
  const inkSpread = readableInk(spec.ink, spreadPaper);

  const spread = useMemo(
    () =>
      layoutSpread(
        {
          layout: spec.layout,
          overlap: spec.photos.some((p) => p.overlap),
          count: spec.photos.length,
          keySlot,
        },
        H,
        SPREAD_W * H,
        margin,
      ),
    [spec.layout, spec.photos, keySlot, H, margin],
  );

  /** Слова, которые сделали книжку, подчёркнуты краской дня; пометка — что они изменили. */
  const renderText = (text: string) =>
    markText(text, marks).map((s, i) =>
      s.note ? (
        <span key={i} className="cause" title={s.note}>
          {s.text}
        </span>
      ) : (
        s.text
      ),
    );

  const threadTh = Math.max(8, Math.round(H * 0.04));
  const threadFor = (i: number, q: PanelPlan) => {
    if (!thread) return null;
    const x0 = thread.starts[i];
    const w = q.w * H;
    const ticks = thread.ticks.filter((t) => t.x >= x0 && t.x <= x0 + q.w);
    const peakX = i === rightIndex ? 0 : i === rightIndex - 1 ? w : null;
    const bottom = Math.round(H * 0.022);
    return (
      <>
        <svg
          className="thread"
          aria-hidden="true"
          width={w}
          height={threadTh}
          viewBox={`0 0 ${w} ${threadTh}`}
          style={{ bottom }}
        >
          <line className="thread-base" x1={0} x2={w} y1={threadTh - 0.5} y2={threadTh - 0.5} />
          {ticks.map((t, k) => {
            const x = (t.x - x0) * H;
            return (
              <line
                key={k}
                className={t.down ? 'thread-tick down' : 'thread-tick'}
                x1={x}
                x2={x}
                y1={t.down ? 0 : threadTh * 0.5}
                y2={threadTh}
              />
            );
          })}
          {peakX !== null && (
            <circle className="thread-peak" cx={peakX} cy={threadTh - 0.5} r={3.2} />
          )}
          {i === rightIndex && (
            <text className="thread-label" x={7} y={threadTh * 0.42}>
              пик {formatSec(thread.peakSec)}
            </text>
          )}
        </svg>
        <span
          className="thread-head"
          aria-hidden="true"
          style={{
            left: `calc(var(--ph, -100px) - ${(x0 * H).toFixed(1)}px)`,
            bottom,
            height: threadTh,
          }}
        />
      </>
    );
  };

  const spreadContent = () => {
    const S = SPREAD_W * H;
    const boxW = S - 2 * margin;
    const keyText = capitalize(spec.key.text);
    const turn = spec.key.by === 'transition' ? spec.key.transition : undefined;
    // Фраза дословно: переход («А потом —») тише, сама перемена дня — полной краской.
    const turnText = turn ? `${capitalize(turn)} — ` : '';
    const fs = fitFont(turnText + keyText, boxW, spread.textH, H * 0.092, Math.max(11, H * 0.04));
    return (
      <>
        {spread.frames.map((f, i) => {
          const photo = spec.photos[f.slot];
          if (!photo) return null;
          const c = regionCenter(photo.crop);
          const b = f.bordered ? Math.max(4, Math.round(H * 0.016)) : 0;
          const style: CSSProperties = {
            left: f.x,
            top: f.y,
            width: f.w,
            height: f.h,
            transform: f.rot ? `rotate(${f.rot}deg)` : undefined,
          };
          return (
            <div key={i} className={f.bordered ? 'frame printed' : 'frame'} style={style}>
              <div className="frame-in" style={{ inset: b }}>
                <Photo
                  src={photo.src}
                  look={look}
                  region={focusRegion(c.x, c.y)}
                  aspect={(f.w - 2 * b) / (f.h - 2 * b)}
                />
              </div>
            </div>
          );
        })}
        <p
          className="spread-text"
          style={{ left: margin, top: spread.textTop, width: boxW, fontSize: fs }}
        >
          {turn ? (
            <>
              <span className="spread-turn">{turnText}</span>
              {renderText(spec.key.text)}
            </>
          ) : (
            renderText(keyText)
          )}
        </p>
        {notes.length > 0 && (
          <p
            className="spread-margin"
            style={{
              left: margin,
              bottom: Math.round(H * 0.075),
              maxWidth: boxW * 0.6,
              fontSize: Math.max(11, H * 0.031),
            }}
          >
            {notes.map(([w, n], i) => (
              <span key={w}>
                {i > 0 && ' · '}«{w}» — {n}
              </span>
            ))}
          </p>
        )}
        <span
          className="spread-foot"
          style={{ right: margin, bottom: Math.round(H * 0.075), fontSize: Math.max(9, H * 0.028) }}
        >
          № {String(spec.number).padStart(3, '0')} · {formatDate(spec.date)}
        </span>
      </>
    );
  };

  const groupText = useMemo(() => {
    const m = new Map<number, string>();
    for (const q of plan) if (q.text !== undefined) m.set(q.group, q.text);
    return m;
  }, [plan]);

  const foldContent = (q: PanelPlan) => {
    const gw = q.groupW * H;
    const me = Math.min(margin, gw * 0.14);
    const photo = pool[q.episode % Math.max(1, pool.length)];
    const text = groupText.get(q.group) ?? '';
    const vertical = q.groupW < 0.3;
    const winH = Math.round(H * 0.48);
    const capTop = Math.round(H * 0.06) + winH + Math.round(H * 0.035);
    const fs = vertical ? clamp(H * 0.032, 9.5, 12) : Math.max(9.5, Math.round(H * 0.036));
    return (
      <>
        {photo && (
          <div
            className="frame"
            style={{ left: me, top: Math.round(H * 0.06), width: gw - 2 * me, height: winH }}
          >
            <div className="frame-in" style={{ inset: 0 }}>
              <Photo
                src={photo.src}
                look={look}
                region={focusRegion(FOLD_POS[q.episode % FOLD_POS.length], 0.5)}
                aspect={(gw - 2 * me) / winH}
              />
            </div>
          </div>
        )}
        <p
          className={vertical ? 'fold-cap fold-cap-v' : 'fold-cap'}
          style={{
            left: me,
            top: capTop,
            width: gw - 2 * me,
            height: Math.round(H * 0.9) - capTop,
            fontSize: fs,
          }}
        >
          {renderText(text)}
        </p>
      </>
    );
  };

  const shadeBg = (q: PanelPlan) => {
    const a = (v: number) => (v * strength).toFixed(3);
    return q.openA >= 0
      ? `linear-gradient(90deg, rgba(20,12,6,${a(0.05)}), rgba(20,12,6,${a(0.3)}))`
      : `linear-gradient(90deg, rgba(20,12,6,${a(0.42)}), rgba(20,12,6,${a(0.18)}))`;
  };

  const renderPanel = (i: number): ReactNode => {
    const q = plan[i];
    if (!q) return null;
    const cover = q.kind === 'cover';
    const faceStyle: CSSProperties = cover
      ? {}
      : ({
          background: q.kind === 'half' ? 'var(--paper-spread)' : 'var(--paper-fold)',
          '--ink': q.kind === 'half' ? inkSpread : inkFold,
        } as CSSProperties);
    return (
      <div
        key={i}
        className="pnl"
        ref={(el) => {
          pnRefs.current[i] = el;
        }}
        style={{ width: q.w * H, height: H }}
      >
        {cover && (
          <span
            className="stack"
            ref={(el) => {
              stackRef.current = el;
            }}
            aria-hidden="true"
          />
        )}
        <div
          className="face"
          ref={(el) => {
            faceRefs.current[i] = el;
          }}
          style={faceStyle}
        >
          {cover ? (
            <Cover spec={spec} vt />
          ) : (
            <>
              <div
                className="gcanvas"
                style={{ left: -q.offset * H, width: q.groupW * H, height: H }}
              >
                {q.kind === 'half' ? spreadContent() : foldContent(q)}
              </div>
              {threadFor(i, q)}
              <span className="tx-grain" aria-hidden="true" />
              <span className="tx-age" aria-hidden="true" />
              {q.kind === 'half' && (
                <span
                  className={q.side === 'L' ? 'gut gut-l' : 'gut gut-r'}
                  style={{ opacity: Math.min(1, 0.55 + 0.6 * spec.paper.shadow) }}
                  aria-hidden="true"
                />
              )}
            </>
          )}
          <span
            className="shade"
            ref={(el) => {
              shadeRefs.current[i] = el;
            }}
            style={{ background: shadeBg(q) }}
            aria-hidden="true"
          />
        </div>
        {renderPanel(i + 1)}
      </div>
    );
  };

  const song = spec.song;
  const vars = {
    '--paper-fold': foldPaper,
    '--paper-spread': spreadPaper,
    '--grain': (spec.paper.grain * 0.5).toFixed(3),
    '--age': spec.paper.age.toFixed(3),
  } as CSSProperties;

  return (
    <article
      className="book"
      style={vars}
      data-playing={sound === 'playing' || undefined}
      data-open={open || undefined}
    >
      <section className="book-stage" style={tableLight(spec)} aria-label="Книжка дня">
        <header className="book-head">
          <p className="book-no">
            № {String(spec.number).padStart(3, '0')} · {formatDate(spec.date)}
          </p>
          <h1 className="book-name">«{spec.folderName}»</h1>
        </header>

        <div className="book-table">
          <div className="book-scroll" ref={scrollRef} onScroll={onScroll}>
            <div
              className="scene"
              ref={sceneRef}
              role="button"
              tabIndex={0}
              aria-expanded={open}
              aria-label={
                open
                  ? `Сложить книжку «${spec.folderName}»`
                  : `Раскрыть книжку «${spec.folderName}»`
              }
              onClick={onSceneClick}
              onKeyDown={onKey}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => (drag.current = null)}
              style={{
                width: sceneW,
                height: H + 64,
                perspective: H * 4.6,
                touchAction: canDrag ? 'pan-y' : 'pan-x pan-y',
                cursor: canDrag ? 'grab' : 'pointer',
              }}
            >
              <span
                className="floor"
                ref={floorRef}
                style={{ top: H + 22, width: sceneW }}
                aria-hidden="true"
              />
              <div className="chain" ref={chainRef} style={{ top: 18 }}>
                {renderPanel(0)}
              </div>
            </div>
          </div>
        </div>

        <div className="sr-only">
          <h2>Текст дня</h2>
          <ol>
            {[...plan]
              .filter((q) => q.text !== undefined)
              .map((q, i) => (
                <li key={i}>{q.text}</li>
              ))}
            <li>{capitalize(spec.key.text)}</li>
          </ol>
        </div>

        <div className="book-dock">
          <div className="book-controls">
            {song?.trackId ? (
              <button
                type="button"
                className={open ? 'btn' : 'btn btn-primary'}
                onClick={sound === 'playing' ? stopSound : () => void openWithSound()}
                disabled={sound === 'loading'}
              >
                {sound === 'loading'
                  ? 'Готовим фрагмент…'
                  : sound === 'playing'
                    ? 'Остановить звук'
                    : 'Открыть со звуком'}
              </button>
            ) : null}
            <button
              type="button"
              className={song?.trackId || open ? 'btn' : 'btn btn-primary'}
              onClick={toggle}
            >
              {open ? 'Сложить' : song?.trackId ? 'Раскрыть без звука' : 'Раскрыть'}
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              aria-expanded={whyOpen}
              aria-controls="book-why"
              onClick={() => setWhyOpen((v) => !v)}
            >
              Почему так
            </button>
          </div>
          <p className="book-notice" role="status">
            {notice}
          </p>

          {song && (
            <div className="book-song">
              <p className="book-song-name">
                <span>{song.title}</span>
                <span className="book-song-artist"> · {song.artist}</span>
              </p>
              <p className="book-song-meta">
                {song.trackViewUrl && (
                  <a
                    className="am-link"
                    href={song.trackViewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Слушать «${song.title}» в Apple Music`}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <path
                        d="M9 18V6.5l10-2V16M9 18a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 9 18Zm10-2a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 19 16Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Apple Music
                  </a>
                )}
                <span>provided courtesy of iTunes</span>
              </p>
            </div>
          )}
        </div>
      </section>

      <section
        id="book-why"
        className="book-why"
        hidden={!whyOpen}
        style={{ '--paper': spreadPaper, '--ink': inkSpread } as CSSProperties}
        aria-label="Почему книжка получилась такой"
      >
        <h2 className="why-title">Почему так</h2>
        <ol className="why-list">
          {sortWhy(spec.why).map((w, i) => (
            <li key={i}>
              <span className="why-param">{whyLabel(w.param)}</span>
              <span className="why-text">{w.text}</span>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}

function capitalize(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/** Порядок и подписи строк «Почему так»: сначала то, что сильнее всего меняет книжку. */
const WHY_GROUPS: [prefix: string, label: string][] = [
  ['key', 'Главная фраза'],
  ['folds', 'Складки'],
  ['rhythm', 'Ритм'],
  ['reveal', 'Раскрытие'],
  ['mode', 'Снимки'],
  ['paper', 'Бумага'],
  ['layout', 'Раскладка'],
  ['photos', 'Кадры'],
  ['ink', 'Краска'],
  ['folderName', 'Название'],
];

function whyRank(param: string): number {
  const i = WHY_GROUPS.findIndex(([p]) => param === p || param.startsWith(p + '.'));
  return i < 0 ? WHY_GROUPS.length : i;
}

function whyLabel(param: string): string {
  return WHY_GROUPS[whyRank(param)]?.[1] ?? 'Правило';
}

function sortWhy(why: DaySpec['why']): DaySpec['why'] {
  return why
    .map((w, i) => ({ w, i }))
    .sort((a, b) => whyRank(a.w.param) - whyRank(b.w.param) || a.i - b.i)
    .map((x) => x.w);
}

/**
 * Свет дня на столе: тёплая лампа или холодный дневной свет, ярче или темнее — из бумаги
 * и режима обработки. Каждый день лежит в своей комнате.
 */
function tableLight(spec: DaySpec): CSSProperties {
  const warm = clamp(spec.paper.spreadTone, -1, 1);
  const bright = clamp(spec.paper.brightness, 0, 1);
  const rgb =
    warm > 0.15
      ? '255 205 150'
      : warm < -0.15
        ? '190 212 240'
        : spec.mode === 'film'
          ? '250 214 168'
          : '255 244 228';
  const strength = { warm: 0.5, film: 0.42, duotone: 0.62, quiet: 0.34 }[spec.mode];
  const alpha = clamp(strength * (0.55 + 0.6 * bright), 0.12, 0.7);
  const dim = clamp((0.55 - bright) * 0.5 + (spec.mode === 'duotone' ? 0.08 : 0), 0, 0.22);
  const pos = bright > 0.6 ? '50% -10%' : spec.mode === 'duotone' ? '30% 0%' : '22% 8%';
  return {
    '--light': `rgb(${rgb} / ${alpha.toFixed(2)})`,
    '--light-pos': pos,
    '--dim': dim.toFixed(3),
  } as CSSProperties;
}

/** 21.4 → '0:21'. */
function formatSec(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
