import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

export type Route =
  | { name: 'month'; month: string; contents: boolean }
  | { name: 'archive' }
  | { name: 'new' }
  | { name: 'day'; id: string; assembled?: boolean };

let landing: string | null = null;

export function landOnDay(id: string) {
  landing = id;
  location.hash = routeHref({ name: 'day', id });
}

/** Hash-маршруты: работают на GitHub Pages без настройки сервера. */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path === 'new') return { name: 'new' };
  const month = /^month\/(\d{4}-(?:0[1-9]|1[0-2]))(\/contents)?$/.exec(path);
  if (month) return { name: 'month', month: month[1], contents: !!month[2] };
  const day = /^day\/([\w-]+)$/.exec(path);
  if (day) return { name: 'day', id: day[1] };
  return { name: 'archive' };
}

export function routeHref(route: Route): string {
  if (route.name === 'month') return '#/month/' + route.month + (route.contents ? '/contents' : '');
  if (route.name === 'new') return '#/new';
  if (route.name === 'day') return `#/day/${route.id}`;
  return '#/';
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const update = (route: Route) => {
      setRoute(route);
      window.scrollTo(0, 0);
    };
    // Книжка переезжает с полки на стол и обратно на своё место: общий элемент — обложка.
    const onChange = () => {
      const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const route = parseHash(window.location.hash);
      const assembled = route.name === 'day' && route.id === landing;
      landing = null;
      if (assembled) return update({ ...route, assembled: true });
      if (!document.startViewTransition || calm) return update(route);
      document.startViewTransition(() => flushSync(() => update(route)));
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
