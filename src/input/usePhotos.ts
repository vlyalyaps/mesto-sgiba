import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point } from '../types/dayspec';
import { preparePhoto, type PreparedPhoto } from './photo';

export const MAX_PHOTOS = 5;

export interface PhotoItem {
  id: string;
  name: string;
  status: 'loading' | 'ready';
  prepared?: PreparedPhoto;
  url?: string;
  focus?: Point;
}

export interface PhotoProblem {
  key: string;
  name: string;
  message: string;
}

function shortId() {
  return 'p' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}

/** Состояние фото формы: подготовка через preparePhoto, удаление, точка фокуса. */
export function usePhotos(saved?: PhotoItem[]) {
  const [items, setItems] = useState<PhotoItem[]>(saved ?? []);
  const [problems, setProblems] = useState<PhotoProblem[]>([]);
  const alive = useRef(true);
  const urls = useRef(new Set<string>());
  const ref = useRef<PhotoItem[]>(saved ?? []);
  const update = useCallback((fn: (prev: PhotoItem[]) => PhotoItem[]) => {
    ref.current = fn(ref.current);
    setItems(ref.current);
  }, []);

  useEffect(() => {
    alive.current = true;
    const known = urls.current;
    return () => {
      alive.current = false;
      known.forEach((u) => URL.revokeObjectURL(u));
      known.clear();
    };
  }, []);

  // Ссылки на сохранённые снимки делаем в эффекте: уборка выше их же и отзывает.
  useEffect(() => {
    if (!saved?.length) return;
    const ready = saved.flatMap((item) => {
      if (!item.prepared) return [];
      const url = URL.createObjectURL(item.prepared.blob);
      urls.current.add(url);
      return [{ ...item, url }];
    });
    update(() => ready);
  }, [saved, update]);

  const add = useCallback(
    (files: File[]) => {
      const room = MAX_PHOTOS - ref.current.length;
      const accepted = files.slice(0, Math.max(room, 0));
      const skipped = files.length - accepted.length;
      const added: PhotoProblem[] = [];
      if (skipped > 0) {
        added.push({
          key: 'limit' + Date.now(),
          name: '',
          message: `В дне может быть не больше ${MAX_PHOTOS} фото, лишние не добавлены.`,
        });
      }
      const fresh: PhotoItem[] = accepted.map((f) => ({
        id: shortId(),
        name: f.name,
        status: 'loading',
      }));
      update((prev) => [...prev, ...fresh]);
      setProblems((prev) => [...prev, ...added]);
      accepted.forEach((file, i) => {
        const id = fresh[i].id;
        preparePhoto(file).then(
          (prepared) => {
            if (!alive.current) return;
            const url = URL.createObjectURL(prepared.blob);
            urls.current.add(url);
            if (!ref.current.some((p) => p.id === id)) {
              URL.revokeObjectURL(url);
              urls.current.delete(url);
              return;
            }
            update((prev) =>
              prev.map((p) => (p.id === id ? { ...p, status: 'ready', prepared, url } : p)),
            );
          },
          (err: unknown) => {
            if (!alive.current) return;
            update((prev) => prev.filter((p) => p.id !== id));
            setProblems((prev) => [
              ...prev,
              {
                key: id,
                name: file.name,
                message: err instanceof Error ? err.message : 'Не удалось подготовить фото.',
              },
            ]);
          },
        );
      });
    },
    [update],
  );

  const remove = useCallback(
    (id: string) => {
      const gone = ref.current.find((p) => p.id === id);
      if (gone?.url) {
        URL.revokeObjectURL(gone.url);
        urls.current.delete(gone.url);
      }
      update((prev) => prev.filter((p) => p.id !== id));
    },
    [update],
  );

  const setFocus = useCallback(
    (id: string, focus: Point) => {
      update((prev) => prev.map((p) => (p.id === id ? { ...p, focus } : p)));
    },
    [update],
  );

  const dismissProblem = useCallback((key: string) => {
    setProblems((prev) => prev.filter((p) => p.key !== key));
  }, []);

  return { items, problems, add, remove, setFocus, dismissProblem };
}
