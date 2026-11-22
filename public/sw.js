/*
 * Service worker «Места сгиба»: приложение открывается и без сети.
 * Сначала сеть (чтобы всегда была свежая версия), при её отсутствии — копия из кэша.
 * Кэшируем только свои файлы: песни и фрагменты Apple сюда не попадают никогда.
 */
const CACHE = 'mesto-sgiba-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.headers.has('range')) return;

  // Страницу всегда сверяем с сервером: GitHub Pages разрешает браузеру держать её 10 минут,
  // и после выкладки человек видел бы старую версию. Файлы сборки с хешем в имени берём как обычно.
  const fresh = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache' }) : fetch(req);
  event.respondWith(
    fresh
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          void caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        if (req.mode === 'navigate') {
          const shell = await caches.match(self.registration.scope);
          if (shell) return shell;
        }
        return Response.error();
      }),
  );
});
