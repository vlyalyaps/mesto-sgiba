/**
 * Правки автора поверх раскладки правил. Чистые функции, как остальные правила:
 * один DayInput (вместе с правками) всегда даёт один DaySpec.
 */
import type { DaySpec, PageContent, PageElement, PageSpec, Rect } from '../types/dayspec';
import type { LeafBase, SheetContent, SheetDesign, SheetItem, SheetLeaf } from '../types/sheet';

export const EMPTY_DESIGN: SheetDesign = { v: 1, items: [] };

const isSheet = (e: PageElement) => e.kind === 'sticker' && e.motif.startsWith('sheet-');

/** Заходит ли вклейка за сгиб. Лист 4:5, поэтому высота в 1,25 раза длиннее ширины. */
export function crossesSpine(
  e: Rect & { leaf: SheetLeaf; rotation: number; scale: number },
): boolean {
  const turn = (e.rotation * Math.PI) / 180;
  const half =
    ((e.w * Math.abs(Math.cos(turn)) + e.h * 1.25 * Math.abs(Math.sin(turn))) * e.scale) / 2;
  const center = e.x + e.w / 2;
  return e.leaf === 'left' ? center + half > 1 : center - half < 0;
}

/** Часть записи, которая должна появиться на листе, как только она есть в записи. */
function slotOf(e: PageElement): string | null {
  if (e.kind === 'photo') return `photo-${e.photoId}`;
  if (e.kind === 'sticker') return e.motif === 'title' ? 'title' : null;
  return e.kind === 'text' ||
    e.kind === 'date' ||
    e.kind === 'mood' ||
    e.kind === 'weather' ||
    e.kind === 'ticket'
    ? e.kind
    : null;
}

function reference(e: PageElement): SheetContent {
  switch (e.kind) {
    case 'photo':
      return { kind: 'photo', photoId: e.photoId };
    case 'tape':
      return { kind: 'tape', photoId: e.photoId };
    case 'sticker':
      return { kind: 'sticker', motif: e.motif };
    case 'label':
      return { kind: 'label', text: e.text };
    case 'image':
      return { kind: 'image', asset: e.asset };
    case 'ticket':
      return { kind: 'ticket' };
    case 'text':
    case 'date':
    case 'mood':
    case 'weather':
      return { kind: e.kind };
  }
}

function toItem(e: PageElement, id: string, at: number): SheetItem {
  const { leaf, x, y, w, h, rotation, scale, color, layer } = e;
  const item: SheetItem = {
    ...reference(e),
    id,
    leaf,
    x,
    y,
    w,
    h,
    rotation,
    scale,
    color,
    layer,
    at,
  };
  if (crossesSpine(e)) item.look = { clip: true };
  return item;
}

/** Имя вклейки правил по содержимому: от нового текста или фото оно не сбивается. */
function autoIds(page: PageSpec): string[] {
  const counts = new Map<string, number>();
  return page.elements.map((e) => {
    const what =
      e.kind === 'photo' || e.kind === 'tape'
        ? `${e.kind}-${e.photoId}`
        : e.kind === 'sticker'
          ? `sticker-${e.motif}`
          : e.kind;
    const n = counts.get(what) ?? 0;
    counts.set(what, n + 1);
    return `auto-${what}-${n}`;
  });
}

/** Вклейки правил как список: порядок в нём и есть порядок наложения. */
function autoItems(page: PageSpec): SheetItem[] {
  const last = Math.max(1, page.elements.length - 1);
  const ids = autoIds(page);
  return page.elements
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => !isSheet(e))
    .sort((a, b) => a.e.layer - b.e.layer || a.i - b.i)
    .map(({ e, i }) => toItem(e, ids[i], i / last));
}

function leavesOf(page: PageSpec): Record<SheetLeaf, LeafBase> {
  const of = (leaf: SheetLeaf): LeafBase => {
    const sheet = page.elements.find((e) => e.leaf === leaf && isSheet(e));
    return {
      stock: leaf === 'left' ? page.stock : page.stock === 'aged' ? 'aged' : 'white',
      sheet: sheet?.kind === 'sticker' ? sheet.motif : '',
    };
  };
  return { left: of('left'), right: of('right') };
}

const emphasisOf = (page: PageSpec) =>
  page.elements.some((e) => e.kind === 'sticker' && e.motif === 'crossout');

/** Полный список вклеек листа: правки плюс то, что появилось в записи позже. */
export function sheetItems(design: SheetDesign, page: PageSpec): SheetItem[] {
  if (!design.frozen) return [...autoItems(page), ...design.items];
  const seen = new Set(design.frozen.seen);
  const ids = autoIds(page);
  const taken = new Set(design.items.map((item) => item.id));
  const late = page.elements.flatMap((e, i) => {
    const slot = slotOf(e);
    return slot && !seen.has(slot) && !taken.has(ids[i]) ? [toItem(e, ids[i], 1)] : [];
  });
  return late.length ? [...design.items, ...late] : design.items;
}

/**
 * Изменить список вклеек. Добавить своё можно, не останавливая правила; как только
 * изменена их вклейка, лист запоминается целиком.
 */
export function arrange(
  design: SheetDesign,
  page: PageSpec,
  change: (items: SheetItem[]) => SheetItem[],
): SheetDesign {
  const before = sheetItems(design, page);
  const after = change(before);
  if (!design.frozen) {
    const auto = before.length - design.items.length;
    if (before.slice(0, auto).every((item, i) => after[i] === item))
      return { ...design, items: after.slice(auto) };
  }
  const seen = new Set(design.frozen?.seen);
  const kept = new Set(after.map((item) => item.id));
  for (const { id } of before) if (id.startsWith('auto-') && !kept.has(id)) seen.add(id);
  for (const e of page.elements) {
    const slot = slotOf(e);
    if (slot) seen.add(slot);
  }
  return {
    ...design,
    items: after,
    frozen: {
      seen: [...seen],
      leaves: design.frozen?.leaves ?? leavesOf(page),
      emphasis: design.frozen?.emphasis ?? emphasisOf(page),
    },
  };
}

/**
 * Запись дописывают уже на листе. Что автор не трогал, раскладывают правила по новой записи,
 * его вклейки стоят на месте. before — лист правил, по которому автор делал правки.
 */
export function reflow(design: SheetDesign, before: PageSpec, page: PageSpec): SheetDesign {
  const { frozen } = design;
  if (!frozen || before === page) return design;
  const was = new Map(autoItems(before).map((item) => [item.id, item]));
  const now = new Map(autoItems(page).map((item) => [item.id, item]));
  const intact = (item: SheetItem) => {
    const old = was.get(item.id);
    return !!old && JSON.stringify(old) === JSON.stringify(item);
  };
  const movedPrints = new Set(
    design.items.flatMap((item) => (item.kind === 'photo' && !intact(item) ? [item.photoId] : [])),
  );
  // Скотч тронутого отпечатка остаётся при нём.
  const follows = (item: SheetItem) =>
    intact(item) && !(item.kind === 'tape' && movedPrints.has(item.photoId));
  const items = design.items.flatMap((item) => {
    if (!follows(item)) return [item];
    const fresh = now.get(item.id);
    return fresh ? [fresh] : [];
  });

  const seen = new Set(frozen.seen);
  const placed = new Set(items.map((item) => item.id));
  for (const item of now.values()) {
    if (was.has(item.id) || seen.has(item.id) || placed.has(item.id)) continue;
    let at = 0;
    items.forEach((other, i) => {
      if (other.id.startsWith('auto-') && other.layer <= item.layer) at = i + 1;
    });
    items.splice(at, 0, item);
    placed.add(item.id);
  }
  for (const e of page.elements) {
    const slot = slotOf(e);
    if (slot) seen.add(slot);
  }
  return {
    ...design,
    items,
    frozen: { seen: [...seen], leaves: leavesOf(page), emphasis: emphasisOf(page) },
  };
}

/** Разложить заново правилами, оставив то, что автор добавил сам. */
export function rearrange(design: SheetDesign): SheetDesign {
  const { frozen: _, ...rest } = design;
  return {
    ...rest,
    items: design.items.filter(
      (item) => !item.id.startsWith('auto-') && !item.id.startsWith('late-'),
    ),
  };
}

export function withSheet(spec: DaySpec, design: SheetDesign): DaySpec {
  const { page } = spec;
  const captions = new Map<string, string | undefined>();
  const live = new Map<PageElement['kind'], PageElement>();
  for (const e of page.elements) {
    if (e.kind === 'photo') captions.set(e.photoId, e.caption);
    live.set(e.kind, e);
  }
  const content = (item: SheetItem): PageContent | null => {
    switch (item.kind) {
      case 'photo':
        return spec.photos.some((p) => p.photoId === item.photoId)
          ? {
              kind: 'photo',
              photoId: item.photoId,
              caption: item.caption ?? captions.get(item.photoId),
            }
          : null;
      case 'tape':
        return spec.photos.some((p) => p.photoId === item.photoId)
          ? { kind: 'tape', photoId: item.photoId }
          : null;
      case 'sticker':
        return { kind: 'sticker', motif: item.motif };
      case 'label':
        return { kind: 'label', text: item.text };
      case 'image':
        return { kind: 'image', asset: item.asset };
      case 'date':
        return { kind: 'date' };
      case 'text': {
        const e = live.get('text');
        return e?.kind === 'text' ? { kind: 'text', sentences: e.sentences } : null;
      }
      case 'mood': {
        const e = live.get('mood');
        return e?.kind === 'mood' ? { kind: 'mood', mood: e.mood } : null;
      }
      case 'weather': {
        const e = live.get('weather');
        return e?.kind === 'weather' ? { kind: 'weather', weather: e.weather } : null;
      }
      case 'ticket': {
        const e = live.get('ticket');
        return e?.kind === 'ticket' ? { kind: 'ticket', carrier: item.carrier ?? e.carrier } : null;
      }
    }
  };
  const lastBeat = Math.max(0, spec.reveal.beats.length - 1);
  const elements = sheetItems(design, page).flatMap((item): PageElement[] => {
    const body = content(item);
    if (!body) return [];
    const { id, leaf, x, y, w, h, rotation, scale, color, layer, at, look } = item;
    const beat = Math.round(lastBeat * at);
    return [{ ...body, id, leaf, x, y, w, h, rotation, scale, color, layer, beat, look }];
  });
  const own = design.items.length > 0 || !!design.frozen;
  return {
    ...spec,
    page: {
      ...page,
      marker: design.marker ?? page.marker,
      elements,
      sheet: {
        leaves: design.frozen?.leaves ?? leavesOf(page),
        emphasis: design.frozen?.emphasis ?? emphasisOf(page),
        paper: design.paper ?? {},
        scene: design.scene ?? {},
        spiral: design.spiral ?? 'metal',
      },
    },
    why: [
      ...spec.why,
      {
        param: 'page.author',
        text: own
          ? 'Лист дособран автором. Правила предложили стартовую раскладку, остальное расставлено и оформлено вручную.'
          : 'Бумагу и фон выбрал автор. Раскладку листа собрали правила.',
      },
    ],
  };
}
