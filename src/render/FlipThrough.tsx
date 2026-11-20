import { useEffect, useRef } from 'react';
import engine from 'page-flip/dist/js/page-flip.browser.js?url';
import type { DaySpec } from '../types/dayspec';
import { DayLeaves } from './DaySpread';
import { processPhoto, readyPhoto } from './photoModes';

interface Engine {
  loadFromHTML(pages: HTMLElement[]): void;
  flipNext(): void;
  flipPrev(): void;
  getSettings(): { flippingTime: number };
  on(event: 'flip', handler: () => void): void;
}

export function FlipThrough({
  entries,
  back = false,
  done,
}: {
  entries: DaySpec[];
  back?: boolean;
  done: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const previews = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    const book = el.closest('.day-spread')!;
    const portrait = matchMedia('(orientation: portrait)').matches;
    const leaves = Array.from(book.querySelectorAll<HTMLElement>(':scope > .journal-leaf')).filter(
      (leaf) => getComputedStyle(leaf).display !== 'none',
    );
    const start = leaves[0].getBoundingClientRect();
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches || start.bottom < 0 || start.top >= innerHeight) {
      done();
      return;
    }
    const columns = portrait ? 1 : 2;
    const current = leaves.slice(0, columns);
    const next = Array.from(previews.current!.children).flatMap((spread) =>
      Array.from(spread.children).slice(0, columns),
    );
    const currentSheets = current.map((leaf) => ({ leaf, spec: undefined }));
    const targetSheets = next.map((leaf, index) => ({
      leaf,
      spec: entries[Math.floor(index / columns)],
    }));
    const sheets = back ? [...targetSheets, ...currentSheets] : [...currentSheets, ...targetSheets];

    // Отдельный документ прерывает внутренний RAF StPageFlip при размонтировании.
    const frame = document.createElement('iframe');
    frame.title = 'Перелистывание страниц';
    frame.tabIndex = -1;
    frame.style.visibility = 'hidden';
    el.style.height = `${start.height}px`;
    let finished = false;
    let disposed = false;
    function finish() {
      if (disposed || finished) return;
      finished = true;
      done();
    }
    function onMotionChange() {
      if (mq.matches) finish();
    }
    mq.addEventListener('change', onMotionChange);
    frame.onload = async () => {
      const window = frame.contentWindow as
        | (Window & { St?: { PageFlip: new (node: HTMLElement, settings: object) => Engine } })
        | null;
      if (!window?.St) {
        finish();
        return;
      }
      const doc = window.document;
      const root = doc.getElementById('book')!;
      const styles = Array.from(
        document.querySelectorAll('link[rel="stylesheet"], style[data-vite-dev-id]'),
      );
      const ready = styles.map((style) => {
        const sheet = style.cloneNode(true) as HTMLElement;
        const loaded =
          style instanceof HTMLLinkElement
            ? new Promise<void>((resolve) => {
                sheet.addEventListener('load', () => resolve(), { once: true });
                sheet.addEventListener('error', () => resolve(), { once: true });
              })
            : Promise.resolve();
        doc.head.append(sheet);
        return loaded;
      });
      const landing = entries.at(-1)!;
      const prepareLanding = Promise.all(
        landing.photos.map((photo) =>
          processPhoto(photo.src, landing.mode, landing.duo, landing.paper.grain).catch(
            () => undefined,
          ),
        ),
      );
      await Promise.all([
        ...ready,
        Promise.race([
          prepareLanding,
          new Promise<void>((resolve) => window.setTimeout(resolve, 180)),
        ]),
      ]);
      if (disposed || finished) return;
      const pages = sheets.map(({ leaf, spec }) => {
        // StPageFlip меняет cssText внешнего листа, переменные бумаги остаются у вложенного.
        const page = doc.createElement('div');
        page.className = 'turning-page';
        page.inert = true;
        const copy = doc.importNode(leaf, true);
        if (spec) {
          for (const img of copy.querySelectorAll<HTMLImageElement>('img[data-print-id]')) {
            const photo = spec.photos.find((p) => p.photoId === img.dataset.printId);
            if (!photo) continue;
            const processed = readyPhoto(photo.src, spec.mode, spec.duo, spec.paper.grain);
            if (processed) img.src = processed.url;
          }
        }
        page.append(copy);
        root.append(page);
        return page;
      });
      await doc.fonts.ready;
      if (disposed || finished) return;
      // Декодирование исходных отпечатков не задерживает перелист на медленной сети.
      await Promise.race([
        Promise.all(
          Array.from(root.querySelectorAll('img'), (img) => img.decode().catch(() => undefined)),
        ),
        new Promise<void>((resolve) => window.setTimeout(resolve, 150)),
      ]);
      if (disposed || finished) return;

      const count = pages.length;
      const flip = new window.St.PageFlip(root, {
        width: Math.floor(start.width),
        height: Math.floor(start.height),
        size: 'fixed',
        autoSize: false,
        usePortrait: portrait,
        showCover: false,
        useMouseEvents: false,
        mobileScrollSupport: false,
        flippingTime: 680,
        startPage: back ? count - columns : 0,
        maxShadowOpacity: 0.42,
      });
      flip.loadFromHTML(pages);
      frame.style.visibility = 'visible';
      book.setAttribute('data-turning', '');
      let turned = 0;
      const turns = count / columns - 1;
      const turn = () => {
        flip.getSettings().flippingTime = turns === 1 ? 680 : Math.max(100, 380 - turned * 58);
        if (back) flip.flipPrev();
        else flip.flipNext();
      };
      flip.on('flip', () => {
        turned++;
        window.setTimeout(turned >= turns ? finish : turn, 16);
      });
      window.setTimeout(turn, 90);
    };
    frame.srcdoc = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>html, body {margin:0;background:transparent !important;overflow:hidden}#book{position:absolute;inset:0}.turning-page{overflow:hidden}.turning-page>.journal-leaf{width:100%;height:100%;margin:0}.turning-page *{animation:none!important;transition:none!important}</style></head><body><div id="book"></div><script src="${engine}"></script></body></html>`;
    el.append(frame);
    const watchdog = setTimeout(finish, 4400);
    return () => {
      disposed = true;
      clearTimeout(watchdog);
      mq.removeEventListener('change', onMotionChange);
      frame.onload = null;
      frame.remove();
      book.removeAttribute('data-turning');
    };
  }, [entries, back, done]);

  return (
    <div className="flip-window" role="status" aria-label="Перелистываем книгу" ref={host}>
      <div hidden ref={previews}>
        {entries.map((spec) => (
          <div key={spec.id}>
            <DayLeaves spec={spec} preview />
          </div>
        ))}
      </div>
    </div>
  );
}
