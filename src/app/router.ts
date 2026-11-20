import { useEffect, useState } from 'react';

export type Route = { name: 'archive' } | { name: 'new' } | { name: 'day'; id: string };

/** Hash-маршруты: работают на GitHub Pages без настройки сервера. */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path === 'new') return { name: 'new' };
  const day = /^day\/([\w-]+)$/.exec(path);
  if (day) return { name: 'day', id: day[1] };
  return { name: 'archive' };
}

export function routeHref(route: Route): string {
  if (route.name === 'new') return '#/new';
  if (route.name === 'day') return `#/day/${route.id}`;
  return '#/';
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
