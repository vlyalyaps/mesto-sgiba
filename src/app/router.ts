import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

export type Route =
  { name: 'new' } | { name: 'edit'; id: string } | { name: 'gallery'; id?: string };

/** Hash-маршруты: работают на GitHub Pages без настройки сервера. */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path === 'new') return { name: 'new' };
  const edit = /^edit\/([\w-]+)$/.exec(path);
  if (edit) return { name: 'edit', id: edit[1] };
  // '#/day/<id>' — прежний адрес дня: такие ссылки открывают тот же день в галерее.
  const day = /^(?:gallery|day)\/([\w-]+)$/.exec(path);
  return day ? { name: 'gallery', id: day[1] } : { name: 'gallery' };
}

export function routeHref(route: Route): string {
  if (route.name === 'new') return '#/new';
  if (route.name === 'edit') return `#/edit/${route.id}`;
  return '#/gallery' + (route.id ? '/' + route.id : '');
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    let last = parseHash(window.location.hash);
    // Внутри галереи переходы рисует она сама, а сетка держит свою прокрутку.
    const withinGallery = (route: Route) => last.name === 'gallery' && route.name === 'gallery';
    const update = (route: Route) => {
      const keep = withinGallery(route);
      last = route;
      setRoute(route);
      if (!keep) window.scrollTo(0, 0);
    };
    const onChange = () => {
      const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const route = parseHash(window.location.hash);
      if (!document.startViewTransition || calm || withinGallery(route)) return update(route);
      document.startViewTransition(() => flushSync(() => update(route)));
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
