import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_ITEMS } from '../../archive/parseSheet';
import { arrange, EMPTY_DESIGN, sheetItems, withSheet } from '../../rules/sheet';
import type { DaySpec, Overrides } from '../../types/dayspec';
import type { SheetDesign, SheetItem, SheetLeaf } from '../../types/sheet';
import { useBackGuard } from '../backGuard';
import type { DayField, DraftBridge, Editor, Tab, View } from './context';
import { Icon, IconButton, type IconName } from './controls';
import { DayPanel } from './DayPanel';
import { Inspector } from './Inspector';
import { attached, boxOf, createItem, LEAF_H, moveTo, newId, restack } from './model';
import { LayersPanel, PaperPanel, ScenePanel, StickerPanel, TextPanel } from './panels';
import { SheetCanvas } from './SheetCanvas';
import { SheetPreview } from './SheetPreview';
import type { History } from './useHistory';
import './editor.css';

const TABS: { id: Tab; title: string; icon: IconName }[] = [
  { id: 'day', title: 'День', icon: 'day' },
  { id: 'stickers', title: 'Стикеры', icon: 'stickers' },
  { id: 'text', title: 'Надписи', icon: 'text' },
  { id: 'paper', title: 'Бумага', icon: 'paper' },
  { id: 'scene', title: 'Фон', icon: 'scene' },
  { id: 'layers', title: 'Слои', icon: 'layers' },
];
const PANELS = {
  day: DayPanel,
  stickers: StickerPanel,
  text: TextPanel,
  paper: PaperPanel,
  scene: ScenePanel,
  layers: LayersPanel,
};
const VIEWS: { id: View; title: string; short: string }[] = [
  { id: 'both', title: 'Разворот', short: '▯▯' },
  { id: 'left', title: 'Левая страница', short: '▮▯' },
  { id: 'right', title: 'Правая страница', short: '▯▮' },
];
const narrow = () => matchMedia('(max-width: 899px)').matches;

function typing(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement) return true;
  return (
    target instanceof HTMLInputElement &&
    !['range', 'color', 'checkbox', 'radio', 'button'].includes(target.type)
  );
}

export interface SheetEditorProps extends DraftBridge {
  /** День по правилам, без правок листа. */
  base: DaySpec;
  /** Правки в том виде, в каком они ложатся на сегодняшнюю раскладку. */
  design: SheetDesign | undefined;
  history: History<Overrides>;
  palette: string[];
  dirty: boolean;
  busy: boolean;
  status: string;
  failure: string;
  /** Спрашиваем, выйти ли без сохранения. */
  leaving: boolean;
  onDesign(next: (design: SheetDesign) => SheetDesign, tag?: string): void;
  /** Если записи чего-то не хватает, возвращает это поле. */
  onSave(): DayField | undefined;
  onCancel(): void;
  onBack(): void;
  onStay(): void;
  onLeave(): void;
}

/** «Записать день» целиком: слева запись и инструменты, в середине живой лист. */
export function SheetEditor({
  base,
  design: edited,
  history,
  palette,
  dirty,
  busy,
  status,
  failure,
  leaving,
  onDesign,
  onSave,
  onCancel,
  onBack,
  onStay,
  onLeave,
  ...draft
}: SheetEditorProps) {
  const root = useRef<HTMLElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab | null>('day');
  const [view, setView] = useState<View>(() => (narrow() ? 'left' : 'both'));
  const [zoom, setZoom] = useState(1);
  const [magnet, setMagnet] = useState(true);
  const [ids, setIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<DaySpec | null>(null);
  const [wanted, setWanted] = useState<{ field: DayField } | null>(null);

  const edits = history.now;
  const design = edited ?? EMPTY_DESIGN;
  const spec = useMemo(() => withSheet(base, design), [base, design]);
  const items = useMemo(() => {
    const onSheet = new Set(spec.page.elements.map((e) => e.id));
    return sheetItems(design, base.page).filter((item) => onSheet.has(item.id));
  }, [design, base, spec]);
  const selected = useMemo(() => items.filter((item) => ids.includes(item.id)), [items, ids]);

  // Открыли — можно писать. На телефоне клавиатуру сами не поднимаем.
  useEffect(() => {
    if (draft.saved || !matchMedia('(min-width: 900px) and (pointer: fine)').matches) return;
    root.current?.querySelector<HTMLElement>('[data-field="text"]')?.focus();
  }, [draft.saved]);

  useEffect(() => {
    if (!wanted) return;
    const field = root.current?.querySelector<HTMLElement>(`[data-field="${wanted.field}"]`);
    const target = field?.matches('input, textarea, button')
      ? field
      : field?.querySelector<HTMLElement>('input:not(:disabled), button');
    target?.focus();
    target?.scrollIntoView({ block: 'nearest' });
  }, [wanted]);

  useBackGuard(dirty, leaving || busy, () => {
    if (preview) {
      setPreview(null);
      return true;
    }
    onBack();
    return false;
  });

  function changeItems(next: (items: SheetItem[]) => SheetItem[], tag?: string) {
    onDesign((now) => {
      const changed = arrange(now, base.page, next);
      const grew = changed.items.length > now.items.length;
      return grew && changed.items.length > MAX_ITEMS ? now : changed;
    }, tag);
  }
  function update(which: string[], next: (item: SheetItem) => SheetItem, tag?: string) {
    changeItems((all) => all.map((item) => (which.includes(item.id) ? next(item) : item)), tag);
  }
  function reveal(leaf: SheetLeaf) {
    setView((now) => (now === 'both' ? now : leaf));
  }
  function focusField(field: DayField) {
    setTab('day');
    setIds([]);
    setWanted({ field });
  }

  const editor: Editor = {
    ...draft,
    base,
    spec,
    edits,
    design,
    items,
    selected,
    palette,
    view,
    select: setIds,
    reveal,
    changeDesign: onDesign,
    changeItems,
    update,
    focusField,
    pickPhotos: () => files.current?.click(),
    setEdits: (patch, tag) =>
      history.change(
        (now) =>
          Object.fromEntries(
            Object.entries({ ...now, ...patch }).filter(([, v]) => v !== undefined),
          ) as Overrides,
        tag,
      ),
    add(cut, at) {
      const leaf = view === 'both' ? (selected[0]?.leaf ?? 'right') : view;
      // Несколько добавленных подряд не ложатся друг на друга ровной стопкой.
      const step = (design.items.length % 5) - 2;
      const item = createItem(
        cut,
        at ?? { x: (leaf === 'right' ? 1.5 : 0.5) + step * 0.045, y: LEAF_H / 2 + step * 0.05 },
      );
      changeItems((all) => [...all, item]);
      setIds([item.id]);
      reveal(item.leaf);
    },
    remove(which) {
      const picked = items.filter((item) => which.includes(item.id));
      const gone = new Set(attached(items, picked).map((item) => item.id));
      changeItems((all) => all.filter((item) => !gone.has(item.id)));
      setIds((now) => now.filter((id) => !gone.has(id)));
    },
    duplicate(which) {
      const copies = items
        .filter((item) => which.includes(item.id))
        .map((item) => {
          const box = boxOf(item);
          return moveTo({ ...item, id: newId() }, { x: box.cx + 0.05, y: box.cy + 0.05 });
        });
      changeItems((all) => [...all, ...copies]);
      setIds(copies.map((item) => item.id));
    },
    play: () => setPreview(spec),
  };

  function escape(target: EventTarget | null) {
    if (preview) setPreview(null);
    else if (leaving) onStay();
    else if (typing(target)) (target as HTMLElement).blur();
    else if (selected.length) setIds([]);
    else onCancel();
  }

  function key(e: KeyboardEvent) {
    if (busy || e.isComposing) return;
    if (e.key === 'Escape') {
      escape(e.target);
      e.preventDefault();
      return;
    }
    if (preview || typing(e.target)) return;
    const ranged = e.target instanceof HTMLInputElement;
    // По e.code: сочетания работают и в русской раскладке.
    const command = e.ctrlKey || e.metaKey;
    if (command) {
      if (e.code === 'KeyZ') {
        if (e.shiftKey) history.redo();
        else history.undo();
      } else if (e.code === 'KeyY') history.redo();
      else if (e.code === 'KeyD' && selected.length) editor.duplicate(selected.map((i) => i.id));
      else if (e.code === 'KeyA') setIds(items.map((item) => item.id));
      else return;
      e.preventDefault();
      return;
    }
    if (ranged || !selected.length) return;
    const which = selected.map((item) => item.id);
    const arrow = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[e.key];
    if (arrow) {
      const step = e.shiftKey ? 0.03 : 0.005;
      update(
        which,
        (item) => {
          const box = boxOf(item);
          return moveTo(item, { x: box.cx + arrow[0] * step, y: box.cy + arrow[1] * step });
        },
        `nudge:${which.join()}`,
      );
    } else if (e.key === 'Delete' || e.key === 'Backspace') editor.remove(which);
    else if (e.code === 'BracketRight') changeItems((all) => restack(all, which, 'up'));
    else if (e.code === 'BracketLeft') changeItems((all) => restack(all, which, 'down'));
    else return;
    e.preventDefault();
  }
  const latestKey = useRef(key);
  useEffect(() => {
    latestKey.current = key;
  });
  useEffect(() => {
    const listen = (e: KeyboardEvent) => latestKey.current(e);
    window.addEventListener('keydown', listen);
    return () => window.removeEventListener('keydown', listen);
  }, []);

  const Panel = tab ? PANELS[tab] : null;
  const viewAt = VIEWS.findIndex((option) => option.id === view);

  return (
    <main
      ref={root}
      className="ed"
      aria-label="Редактор листа"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDrop={(e) => {
        // На холсте файл уже принят; мимо него — тоже фото дня, а не уход со страницы.
        if (e.defaultPrevented || !e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        const pictures = [...e.dataTransfer.files].filter((file) => file.type.startsWith('image/'));
        if (pictures.length && !busy) draft.photos.add(pictures);
      }}
    >
      <input
        ref={files}
        type="file"
        multiple
        hidden
        accept="image/*"
        aria-label="Файлы фото"
        onChange={(e) => {
          draft.photos.add(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      <header className="ed-top" inert={!!preview}>
        <button type="button" className="ed-cancel" aria-label="Отмена" onClick={onCancel}>
          <Icon name="close" />
          <span>Отмена</span>
        </button>
        <h1>{draft.saved ? 'Изменить день' : 'Записать день'}</h1>
        <div className="ed-tools" inert={busy}>
          <IconButton
            name="undo"
            label="Отменить действие"
            disabled={!history.canUndo}
            onClick={history.undo}
          />
          <IconButton
            name="redo"
            label="Повторить действие"
            disabled={!history.canRedo}
            onClick={history.redo}
          />
          <div className="ed-views" role="group" aria-label="Что показать">
            {VIEWS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={option.id === view}
                aria-label={option.title}
                title={option.title}
                onClick={() => setView(option.id)}
              >
                {option.short}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ed-view-next"
            aria-label={`Показано: ${VIEWS[viewAt].title}. Переключить`}
            onClick={() => setView(VIEWS[(viewAt + 1) % VIEWS.length].id)}
          >
            {VIEWS[viewAt].short}
          </button>
          <div className="ed-zoom">
            <IconButton
              name="minus"
              label="Отдалить лист"
              disabled={zoom <= 0.5}
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
            />
            <button type="button" aria-label="Лист целиком" onClick={() => setZoom(1)}>
              {Math.round(zoom * 100)}%
            </button>
            <IconButton
              name="plus"
              label="Приблизить лист"
              disabled={zoom >= 4}
              onClick={() => setZoom(Math.min(4, zoom + 0.25))}
            />
          </div>
          <IconButton
            name="magnet"
            label="Магнит"
            className="ed-magnet"
            pressed={magnet}
            onClick={() => setMagnet(!magnet)}
          />
          <IconButton name="play" label="Посмотреть сборку листа" onClick={editor.play} />
        </div>
        <button
          type="button"
          className="ed-done"
          disabled={busy}
          aria-busy={busy}
          onClick={() => {
            const missing = onSave();
            if (missing) focusField(missing);
          }}
        >
          {draft.saved ? 'Сохранить день' : 'Сложить день'}
        </button>

        <div className="ed-notices">
          <p className="ed-status" role="status">
            {status}
          </p>
          {failure && (
            <p className="ed-failure" role="alert">
              {failure}
            </p>
          )}
          {leaving && (
            <div className="ed-leave" role="group" aria-label="Выход из записи">
              <p>Выйти без сохранения?</p>
              <button type="button" onClick={onLeave}>
                Выйти
              </button>
              <button type="button" className="ed-stay" autoFocus onClick={onStay}>
                Остаться
              </button>
            </div>
          )}
        </div>
      </header>

      <div
        className="ed-body"
        data-tab={tab ?? undefined}
        data-selected={selected.length > 0 || undefined}
        data-closed={!tab || undefined}
        inert={busy || !!preview}
        aria-busy={busy}
      >
        <nav className="ed-tabs" aria-label="Инструменты">
          {TABS.map(({ id, title, icon }) => (
            <button
              key={id}
              type="button"
              data-tab={id}
              aria-pressed={tab === id}
              onClick={() => {
                // На узком экране настройки и набор делят одно место.
                const covered = selected.length > 0 && matchMedia('(max-width: 1179px)').matches;
                if (covered) setIds([]);
                setTab(tab === id && !covered && narrow() ? null : id);
              }}
            >
              <Icon name={icon} />
              <span>{title}</span>
            </button>
          ))}
        </nav>
        <aside
          key={`panel-${tab}`}
          className="ed-panel"
          aria-label={TABS.find((t) => t.id === tab)?.title}
        >
          {Panel && (
            <div className="ed-panel-body" key={tab}>
              <Panel editor={editor} />
            </div>
          )}
        </aside>
        <SheetCanvas editor={editor} zoom={zoom} magnet={magnet} />
        <aside
          // Другая деталь — настройки с начала, а не с прежней прокрутки.
          key={`detail-${selected[0]?.id ?? 'layers'}`}
          className="ed-inspector"
          aria-label="Настройки детали"
        >
          {selected.length ? (
            <Inspector key={selected[0].id} editor={editor} />
          ) : (
            <div className="ed-inspector-body">
              <header className="ed-side-head">
                <h2>Слои</h2>
              </header>
              <LayersPanel editor={editor} />
            </div>
          )}
        </aside>
      </div>

      {preview && <SheetPreview spec={preview} onClose={() => setPreview(null)} />}
    </main>
  );
}
