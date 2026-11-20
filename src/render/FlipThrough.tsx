import { useEffect, useRef } from 'react';
import engine from 'page-flip/dist/js/page-flip.browser.js?url';
import type { DaySpec } from '../types/dayspec';
import { formatDate } from './format';
interface Engine {
  loadFromHTML(pages: HTMLElement[]): void;
  flipNext(): void;
  flipPrev(): void;
  getSettings(): { flippingTime: number };
  on(event: 'flip', handler: () => void): void;
}
/** Отдельный документ завершает и собственный RAF StPageFlip 2 при уходе с разворота. */
export function FlipThrough({
  entries,
  target,
  back = false,
  done,
}: {
  entries: DaySpec[];
  target: DaySpec;
  back?: boolean;
  done: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current!;
    const frame = document.createElement('iframe');
    const portrait = matchMedia('(orientation:portrait)').matches;
    const cols = portrait ? 1 : 2;
    const turns = Math.min(
      14,
      8 +
        Math.max(
          0,
          entries.findIndex((e) => e.id === target.id),
        ),
    );
    const texture = new URL(import.meta.env.BASE_URL + 'textures/cream.webp', location.origin).href;
    const finish = () => done();
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      finish();
      return;
    }
    const reduced = () => {
      if (mq.matches) finish();
    };
    mq.addEventListener('change', reduced);
    frame.title = 'Перелистывание страниц';
    frame.tabIndex = -1;
    frame.onload = () => {
      const w = frame.contentWindow as
        | (Window & { St?: { PageFlip: new (node: HTMLElement, settings: object) => Engine } })
        | null;
      if (!w?.St) {
        finish();
        return;
      }
      const doc = w.document,
        root = doc.getElementById('book')!;
      const rect = frame.getBoundingClientRect();
      const count = (turns + 1) * cols;
      const pageList = Array.from({ length: count }, (_, i) => {
        const entry = (back ? i === 0 : i >= count - cols)
          ? target
          : (entries[Math.floor(i / cols) % entries.length] ?? target);
        const page = doc.createElement('div');
        page.className = 'sheet';
        page.style.backgroundImage = `url("${texture}")`;
        const date = doc.createElement('small');
        date.textContent = formatDate(entry.date);
        const picture = entry.photos[i % Math.max(1, entry.photos.length)];
        const img = doc.createElement('img');
        if (picture) img.src = picture.src;
        const phrase = doc.createElement('p');
        phrase.textContent = entry.key.text;
        page.append(date, ...(picture ? [img] : []), phrase);
        root.append(page);
        return page;
      });
      const book = new w.St.PageFlip(root, {
        width: Math.max(100, Math.floor(rect.width / cols)),
        height: Math.max(100, Math.floor(rect.height)),
        size: 'fixed',
        autoSize: false,
        usePortrait: portrait,
        showCover: false,
        useMouseEvents: false,
        mobileScrollSupport: false,
        flippingTime: 225,
        startPage: back ? count - cols : 0,
        maxShadowOpacity: 0.38,
      });
      book.loadFromHTML(pageList);
      let turned = 0;
      const next = () => {
        book.getSettings().flippingTime = Math.max(85, 225 - turned * 16);
        if (back) book.flipPrev();
        else book.flipNext();
      };
      book.on('flip', () => {
        turned++;
        w.setTimeout(turned >= turns ? finish : next, 18);
      });
      w.setTimeout(next, 80);
    };
    frame.srcdoc = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:#d4c5a8;overflow:hidden}#book{width:100vw;height:100vh}.sheet{padding:8%;color:#473d31;background-color:#f6ead1;background-size:480px;overflow:hidden;box-shadow:inset 4px 0 20px #62491f26}.sheet small{font:12px monospace}.sheet img{display:block;width:91%;height:48%;object-fit:cover;border:6px solid ivory;margin:8% auto;transform:rotate(-3deg);box-shadow:0 3px 5px #0003}.sheet p{font:italic 22px Georgia}</style></head><body><div id="book"></div><script src="${engine}"></script></body></html>`;
    el.append(frame);
    const watchdog = setTimeout(finish, 4500);
    return () => {
      clearTimeout(watchdog);
      mq.removeEventListener('change', reduced);
      frame.onload = null;
      frame.remove();
    };
  }, [entries, target, back, done]);
  return (
    <div className="flip-curtain" role="status" aria-label="Перелистываем книгу">
      <div className="flip-window" ref={host} />
    </div>
  );
}
