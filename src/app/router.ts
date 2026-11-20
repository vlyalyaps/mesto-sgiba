import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

export type Route =
  | { name: 'month'; month: string; contents: boolean }
  | { name: 'archive' }
  | { name: 'new' }
  | { name: 'day'; id: string }
  | { name: 'gallery'; id?: string };

/** Hash-маршруты: работают на GitHub Pages без настройки сервера. */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path === 'new') return { name: 'new' };
  const month = /^month\/(\d{4}-(?:0[1-9]|1[0-2]))(\/contents)?$/.exec(path);
  if (month) return { name: 'month', month: month[1], contents: !!month[2] };
  const day = /^day\/([\w-]+)$/.exec(path);
  if (day) return { name: 'day', id: day[1] };
  const gallery = /^gallery(?:\/([\w-]+))?$/.exec(path);
  if (gallery) return gallery[1] ? { name: 'gallery', id: gallery[1] } : { name: 'gallery' };
  return { name: 'archive' };
}

export function routeHref(route: Route): string {
  if (route.name === 'month') return '#/month/' + route.month + (route.contents ? '/contents' : '');
  if (route.name === 'new') return '#/new';
  if (route.name === 'day') return `#/day/${route.id}`;
  if (route.name === 'gallery') return '#/gallery' + (route.id ? '/' + route.id : '');
  return '#/';
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    let last = parseHash(window.location.hash);
    // Внутри галереи переходы рисует она сама, а сетка держит свою прокрутку.
    const withinGallery = () =>
      last.name === 'gallery' && parseHash(window.location.hash).name === 'gallery';
    const update = () => {
      const keep = withinGallery();
      last = parseHash(window.location.hash);
      setRoute(last);
      if (!keep) window.scrollTo(0, 0);
    };
    // Книжка переезжает с полки на стол и обратно на своё место: общий элемент — обложка.
    const onChange = () => {
      const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (!document.startViewTransition || calm || withinGallery()) return update();
      document.startViewTransition(() => flushSync(update));
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
