import type { SheetItem } from '../../types/sheet';
import { cutoutByKey, type Cutout } from './catalog';
import type { Editor } from './context';

const OWN: Record<string, string> = {
  title: 'Название дня',
  'life-label-digital': 'Метка года',
  'object-venue': 'Событие',
  'object-food': 'Еда',
  'object-star': 'Звёзды',
};

/** Вклейку правил зовём так же, как её картинку в наборе. */
function scanName(motif: string): string | undefined {
  const name = motif.replace(/^life-/, '');
  const keys = [
    `sticker:${motif}`,
    motif === name ? `image:scraps/047/${name}` : `image:scraps/life/${name}`,
    `image:scraps/materials/${name}`,
    `image:stickers/${motif.replace(/^object-/, '')}`,
  ];
  for (const key of keys) {
    const found = cutoutByKey(key);
    if (found) return found.title;
  }
  return undefined;
}

/** Имя вклейки в слоях и над настройками. */
export function nameOf(item: SheetItem, editor: Editor): string {
  switch (item.kind) {
    case 'photo': {
      const n = editor.spec.photos.findIndex((p) => p.photoId === item.photoId) + 1;
      return `Фото ${n}`;
    }
    case 'tape':
      return 'Скотч у фото';
    case 'text':
      return 'Запись дня';
    case 'date':
      return 'Дата';
    case 'mood':
      return 'Настроение';
    case 'weather':
      return 'Погода';
    case 'ticket':
      return 'Песня';
    case 'label':
      return item.text.trim().slice(0, 28) || 'Пустая надпись';
    case 'image':
      return cutoutByKey(`image:${item.asset}`)?.title ?? 'Картинка';
    case 'sticker':
      return OWN[item.motif] ?? scanName(item.motif) ?? 'Деталь листа';
  }
}

/** Отпечаток снимка дня: высота — по его кадру. */
export function photoCutout(editor: Editor, id: string): Cutout | undefined {
  const photo = editor.photos.items.find((p) => p.id === id)?.prepared;
  if (!photo) return undefined;
  const aspect = photo.width / photo.height;
  return {
    key: `photo:${id}`,
    title: 'Фото',
    content: { kind: 'photo', photoId: id },
    w: aspect < 0.9 ? 0.42 : 0.58,
    ratio: aspect * 0.94,
    layer: 3,
    rotation: -2,
  };
}
