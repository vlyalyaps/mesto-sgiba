/**
 * Сборка разворота как движение рук: каждый кусочек появляется по-своему и в свой момент.
 * Анимации ведёт сам браузер (Web Animations), React во время сборки ничего не перерисовывает.
 * Конечное состояние не задаётся: кусочек приходит к своим обычным стилям (поворот, прозрачность).
 */
type Entrance = { frames: Keyframe[]; ms: number; easing: string };

/** Резкий выход с мягкой посадкой — кусочек кладут, а не проявляют. */
const PLACE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const DRAW = 'cubic-bezier(0.45, 0.05, 0.25, 1)';

function entrance(el: HTMLElement, i: number): Entrance {
  const kind = el.dataset.kind;
  const tilt = i % 2 ? -1 : 1;
  if (el.dataset.hero !== undefined)
    return {
      // Главный кадр опускают на лист чуть с размаху: он крупнее, выше и прижимается к бумаге.
      frames: [
        { offset: 0, opacity: 0, translate: '0 -28px', scale: 1.16, rotate: `${-4 * tilt}deg` },
        { offset: 0.22, opacity: 1 },
        { offset: 0.72, scale: 0.985, translate: '0 1px', rotate: `${0.4 * tilt}deg` },
        { offset: 1 },
      ],
      ms: 640,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    };
  if (el.classList.contains('diary-ink'))
    return {
      // Рисунок ручкой прорисовывается слева направо.
      frames: [
        { offset: 0, opacity: 0, clipPath: 'inset(-8% 108% -8% -8%)' },
        { offset: 0.12, opacity: 1 },
        { offset: 1, clipPath: 'inset(-8% -8% -8% -8%)' },
      ],
      ms: 560,
      easing: DRAW,
    };
  if (
    el.classList.contains('diary-stain') ||
    /^life-(blot|vellum|tape-ghost)/.test(el.dataset.motif ?? '')
  )
    return {
      // Пятно впитывается в бумагу.
      frames: [{ offset: 0, opacity: 0, scale: 0.9 }, { offset: 1 }],
      ms: 760,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    };
  switch (kind) {
    case 'photo':
      return {
        frames: [
          { offset: 0, opacity: 0, translate: '0 -14px', scale: 1.07, rotate: `${3 * tilt}deg` },
          { offset: 0.3, opacity: 1 },
          { offset: 1 },
        ],
        ms: 480,
        easing: PLACE,
      };
    case 'tape':
      return {
        // Полоску скотча натягивают и прижимают.
        frames: [
          { offset: 0, opacity: 0, scale: '0.45 1', translate: '0 -3px' },
          { offset: 0.35, opacity: 1 },
          { offset: 1 },
        ],
        ms: 260,
        easing: 'cubic-bezier(0.3, 0.7, 0.1, 1)',
      };
    case 'text':
      return {
        // Запись проступает строками сверху вниз, как будто её пишут.
        frames: [
          { offset: 0, opacity: 0, clipPath: 'inset(-8% -8% 108% -8%)' },
          { offset: 0.08, opacity: 1 },
          { offset: 1, clipPath: 'inset(-8% -8% -8% -8%)' },
        ],
        ms: 900,
        easing: 'cubic-bezier(0.33, 0, 0.2, 1)',
      };
    case 'ticket':
      return {
        frames: [
          { offset: 0, opacity: 0, translate: '-22px 6px', rotate: `${-5 * tilt}deg` },
          { offset: 0.3, opacity: 1 },
          { offset: 1 },
        ],
        ms: 460,
        easing: PLACE,
      };
    case 'sticker':
      return {
        // Наклейку прихлопывают: чуть крупнее, с поворотом, и она садится на место.
        frames: [
          { offset: 0, opacity: 0, scale: 1.24, rotate: `${-7 * tilt}deg` },
          { offset: 0.25, opacity: 1 },
          { offset: 0.65, scale: 0.97 },
          { offset: 1 },
        ],
        ms: 400,
        easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
      };
    default:
      return {
        frames: [{ offset: 0, opacity: 0, translate: '0 8px' }, { offset: 1 }],
        ms: 340,
        easing: PLACE,
      };
  }
}

/** Главный кадр начинает падать чуть раньше, чтобы коснуться листа ровно в срок. */
const HERO_LEAD_MS = 220;

export interface Reveal {
  /** Отложить ещё не начавшиеся появления: звук пошёл позже часов страницы. */
  shift(ms: number): void;
  /** Главный кадр касается листа через `ms` (по часам звука). Повторный вызов ничего не меняет. */
  land(ms: number): void;
  cancel(): void;
  /** Все кусочки на месте. */
  done: Promise<void>;
}

/**
 * Запустить сборку: `delays[i]` — через сколько секунд появляется элемент `data-element=i`.
 * `holdHero` — главный кадр ждёт `land()`, чтобы лечь ровно на пик песни.
 */
export function reveal(root: HTMLElement, delays: number[], holdHero = false): Reveal {
  const pieces = root.querySelectorAll<HTMLElement>('[data-element]');
  const runs: { a: Animation; delay: number }[] = [];
  let hero: Animation | null = null;
  let landed = !holdHero;
  for (const el of pieces) {
    const i = Number(el.dataset.element);
    const { frames, ms, easing } = entrance(el, i);
    const isHero = el.dataset.hero !== undefined;
    const delay = Math.max(0, (delays[i] ?? 0) * 1000);
    if (isHero && holdHero) {
      const a = el.animate(frames, { duration: ms, easing, fill: 'backwards' });
      a.pause();
      hero = a;
      runs.push({ a, delay: 0 });
      continue;
    }
    const a = el.animate(frames, { duration: ms, easing, delay, fill: 'backwards' });
    runs.push({ a, delay });
  }
  // Пик песни: разворот чуть проседает под главным кадром.
  const thump = () =>
    root.animate([{ offset: 0 }, { offset: 0.35, scale: 0.994 }, { offset: 1 }], {
      duration: 380,
      easing: 'cubic-bezier(0.3, 0, 0.2, 1)',
    });
  let thumped: Animation | null = null;
  const done = Promise.all(
    runs.map(({ a }) =>
      a.finished.then(
        () => a.cancel(),
        () => undefined,
      ),
    ),
  ).then(() => undefined);
  return {
    shift(ms) {
      if (ms <= 0) return;
      for (const { a, delay } of runs) {
        if (a === hero || a.playState !== 'running' || a.startTime === null) continue;
        if (Number(a.currentTime ?? 0) < delay) a.startTime = Number(a.startTime) + ms;
      }
    },
    land(ms) {
      if (landed) return;
      landed = true;
      if (!hero) return;
      const now = Number(document.timeline.currentTime ?? performance.now());
      const touch = Math.max(HERO_LEAD_MS, ms);
      hero.play();
      hero.startTime = now + touch - HERO_LEAD_MS;
      const h = hero;
      const wait = setTimeout(() => {
        if (h.playState !== 'idle') thumped = thump();
      }, touch);
      h.finished.catch(() => clearTimeout(wait));
    },
    cancel() {
      for (const { a } of runs) a.cancel();
      thumped?.cancel();
    },
    done,
  };
}
