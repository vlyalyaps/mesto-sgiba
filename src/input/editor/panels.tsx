import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { assetUrl, textureUrl, thumbUrl } from '../../render/assets';
import { rearrange } from '../../rules/sheet';
import type { CutAlphabet, DaySpec } from '../../types/dayspec';
import type {
  LeafPaper,
  Ruling,
  SheetContent,
  SheetFont,
  SheetItem,
  SheetLeaf,
  SheetScene,
  SpiralLook,
} from '../../types/sheet';
import { ALPHABETS, GROUPS, LETTERS, PAPERS, letter, startGroup, type Cutout } from './catalog';
import type { Editor } from './context';
import { Chips, IconButton, Section, Slider, Swatches } from './controls';
import { Fonts, TitleField } from './fields';
import { luminance, restack } from './model';
import { MotifThumb } from './MotifThumb';
import { nameOf } from './names';

const TARGETS = [
  { id: 'both', title: 'Обе' },
  { id: 'left', title: 'Левая' },
  { id: 'right', title: 'Правая' },
] as const;
const RULINGS: { id: Ruling; title: string }[] = [
  { id: 'plain', title: 'Чистая' },
  { id: 'ruled', title: 'С полем' },
  { id: 'lines', title: 'Линейка' },
  { id: 'grid', title: 'Клетка' },
  { id: 'dots', title: 'Точки' },
  { id: 'staff', title: 'Ноты' },
  { id: 'diagonal', title: 'Косая' },
];
const SPIRALS: { id: SpiralLook; title: string }[] = [
  { id: 'metal', title: 'Металл' },
  { id: 'dark', title: 'Чёрная' },
  { id: 'gold', title: 'Золото' },
  { id: 'white', title: 'Белая' },
  { id: 'none', title: 'Без неё' },
];

const tidy = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

function darkPaper(paper: LeafPaper): boolean {
  if (PAPERS.some((p) => p.id === paper.texture && p.dark)) return true;
  if (!paper.color) return false;
  const strength = !paper.texture || paper.texture === 'none' ? 1 : (paper.strength ?? 0.6);
  return luminance(paper.color) * strength + (1 - strength) < 0.36;
}

function Textures({
  editor,
  value,
  onChange,
  reset,
}: {
  editor: Editor;
  value: string | undefined;
  onChange: (texture: string | undefined) => void;
  reset: string;
}) {
  const options = [
    ...PAPERS.map(({ id, title }) => ({ id, title, url: thumbUrl(id) })),
    ...editor.spec.photos.map((photo, i) => ({
      id: `photo:${photo.photoId}`,
      title: `Фото ${i + 1}`,
      url: textureUrl(`photo:${photo.photoId}`, editor.spec.photos),
    })),
  ];
  return (
    <div className="ed-textures">
      <button type="button" aria-pressed={!value} onClick={() => onChange(undefined)}>
        <span className="ed-texture ed-texture-auto" />
        <small>{reset}</small>
      </button>
      <button type="button" aria-pressed={value === 'none'} onClick={() => onChange('none')}>
        <span className="ed-texture ed-texture-none" />
        <small>Только цвет</small>
      </button>
      {options.map(({ id, title, url }) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>
          <span
            className="ed-texture"
            style={{ backgroundImage: url ? `url("${url}")` : undefined }}
          />
          <small>{title}</small>
        </button>
      ))}
    </div>
  );
}

export function PaperPanel({ editor }: { editor: Editor }) {
  const [target, setTarget] = useState<'both' | SheetLeaf>('both');
  const { design, spec } = editor;
  const leaves: SheetLeaf[] = target === 'both' ? ['left', 'right'] : [target];
  const paper: LeafPaper = design.paper?.[leaves[0]] ?? {};
  const set = (patch: Partial<LeafPaper>, name: string) =>
    editor.changeDesign((now) => {
      const next = { ...now.paper };
      for (const leaf of leaves) {
        const value = tidy<LeafPaper>({ ...next[leaf], ...patch });
        // Тёмная бумага сама переключает записи на светлые чернила.
        if (darkPaper(value)) value.dark = true;
        else delete value.dark;
        if (Object.keys(value).length) next[leaf] = value;
        else delete next[leaf];
      }
      return { ...now, paper: next };
    }, `paper-${name}-${target}`);
  return (
    <>
      <Chips label="Какая страница" options={TARGETS} value={target} onChange={setTarget} />
      <Section title="Фактура">
        <Textures
          editor={editor}
          reset="По правилам"
          value={paper.texture}
          onChange={(texture) => set({ texture }, 'texture')}
        />
        {paper.texture && paper.texture !== 'none' && (
          <Slider
            label="Размер фактуры"
            min={0.2}
            max={2.5}
            value={paper.zoom ?? 1}
            onChange={(zoom) => set({ zoom }, 'zoom')}
          />
        )}
      </Section>
      <Section title="Цвет бумаги">
        <Swatches
          label="Цвет бумаги"
          palette={editor.palette}
          value={paper.color}
          onChange={(color) => set({ color }, 'color')}
        />
        {paper.color && paper.texture !== 'none' && (
          <Slider
            label="Сила цвета"
            min={0}
            max={1}
            value={paper.strength ?? 0.6}
            onChange={(strength) => set({ strength }, 'strength')}
          />
        )}
      </Section>
      <Section title="Линовка">
        <Chips
          label="Линовка"
          options={RULINGS}
          value={paper.ruling}
          onChange={(ruling) =>
            set({ ruling: paper.ruling === ruling ? undefined : ruling }, 'ruling')
          }
        />
        {paper.ruling && paper.ruling !== 'plain' && (
          <Swatches
            label="Цвет линовки"
            palette={editor.palette}
            value={paper.line}
            onChange={(line) => set({ line }, 'line')}
          />
        )}
      </Section>
      <Section title="Пружина">
        <Chips
          label="Пружина"
          options={SPIRALS}
          value={design.spiral ?? 'metal'}
          onChange={(spiral) => editor.changeDesign((now) => ({ ...now, spiral }))}
        />
      </Section>
      <Section title="Маркер главной фразы">
        <Swatches
          label="Маркер"
          palette={editor.palette}
          value={design.marker ?? spec.page.marker}
          onChange={(marker) => editor.changeDesign((now) => tidy({ ...now, marker }), 'marker')}
        />
      </Section>
    </>
  );
}

function ResetButtons({ editor }: { editor: Editor }) {
  if (!editor.edits.design) return null;
  return (
    <div className="ed-resets">
      {editor.design.frozen && (
        <button type="button" className="ed-link" onClick={() => editor.changeDesign(rearrange)}>
          Разложить заново, оставив моё
        </button>
      )}
      <button
        type="button"
        className="ed-link"
        onClick={() => {
          editor.select([]);
          editor.setEdits({ design: undefined });
        }}
      >
        Сбросить лист
      </button>
    </div>
  );
}

const SCENE_TOGGLES = [
  { key: 'stars', title: 'Пыль в луче' },
  { key: 'sparks', title: 'Искры' },
  { key: 'orbits', title: 'Орбиты' },
] as const;

export function ScenePanel({ editor }: { editor: Editor }) {
  const scene: SheetScene = editor.design.scene ?? {};
  const set = (patch: Partial<SheetScene>, name: string) =>
    editor.changeDesign(
      (now) => ({ ...now, scene: tidy<SheetScene>({ ...now.scene, ...patch }) }),
      `scene-${name}`,
    );
  /** Цвет и картинка сами решают, тёмные ли нужны надписи. */
  const back = (patch: Partial<SheetScene>, name: string) => {
    const next = { ...scene, ...patch };
    const known = PAPERS.find((p) => p.id === next.texture);
    const lightness = next.texture?.startsWith('photo:')
      ? editor.photos.items.find((p) => `photo:${p.id}` === next.texture)?.prepared?.lightness
      : undefined;
    let shade = known ? (known.dark ? 0.1 : 0.82) : (lightness ?? (next.color ? 1 : 0));
    if (next.color) shade *= luminance(next.color);
    shade *= 1 - (next.dim ?? 0);
    set({ ...patch, light: shade > 0.58 || undefined }, name);
  };
  return (
    <>
      <Section title="Фон за книгой">
        <Textures
          editor={editor}
          reset="Космос"
          value={scene.texture}
          onChange={(texture) => back({ texture }, 'texture')}
        />
      </Section>
      <Section title="Цвет фона">
        <Swatches
          label="Цвет фона"
          palette={editor.palette}
          value={scene.color}
          onChange={(color) => back({ color }, 'color')}
        />
        {scene.texture && scene.texture !== 'none' && (
          <Slider
            label="Размытие"
            min={0}
            max={40}
            step={1}
            show={(v) => `${v}`}
            value={scene.blur ?? 0}
            onChange={(blur) => set({ blur }, 'blur')}
          />
        )}
        {(scene.texture || scene.color) && (
          <Slider
            label="Затемнение"
            min={0}
            max={0.95}
            value={scene.dim ?? 0}
            onChange={(dim) => back({ dim }, 'dim')}
          />
        )}
      </Section>
      <Section title="Свет за книгой">
        <Swatches
          label="Цвет света"
          reset="В цвет дня"
          palette={editor.palette}
          value={scene.glow}
          onChange={(glow) => set({ glow }, 'glow')}
        />
        <Slider
          label="Сила света"
          min={0}
          max={1}
          value={scene.glowPower ?? 1}
          onChange={(glowPower) => set({ glowPower }, 'power')}
        />
      </Section>
      <Section title="В пространстве">
        <div className="ed-chips">
          {SCENE_TOGGLES.map(({ key, title }) => (
            <button
              key={key}
              type="button"
              className="ed-chip"
              aria-pressed={scene[key] !== false}
              onClick={() => set({ [key]: scene[key] === false ? undefined : false }, key)}
            >
              {title}
            </button>
          ))}
          <button
            type="button"
            className="ed-chip"
            aria-pressed={!!scene.light}
            onClick={() => set({ light: scene.light ? undefined : true }, 'light')}
          >
            Тёмные надписи
          </button>
        </div>
      </Section>
      {editor.design.scene && (
        <button
          type="button"
          className="ed-link"
          onClick={() => editor.changeDesign((now) => tidy({ ...now, scene: undefined }))}
        >
          Вернуть обычный фон
        </button>
      )}
    </>
  );
}

const PRESETS: Cutout[] = [
  {
    key: 'label-hand',
    title: 'Рукописная',
    content: { kind: 'label', text: 'Запомнить это' },
    w: 0.6,
    ratio: 4.2,
    layer: 1,
    look: { font: 'caveat-bold', size: 9 },
    rotation: -2,
  },
  {
    key: 'label-title',
    title: 'Заголовок',
    content: { kind: 'label', text: 'ТОТ САМЫЙ ДЕНЬ' },
    w: 0.78,
    ratio: 4.4,
    layer: 1,
    look: { font: 'golos-black', size: 7 },
  },
  {
    key: 'label-type',
    title: 'Печатная',
    content: { kind: 'label', text: 'заметка на полях' },
    w: 0.56,
    ratio: 6,
    layer: 1,
    look: { font: 'mono', size: 3.8 },
  },
  {
    key: 'label-tag',
    title: 'На ярлыке',
    content: { kind: 'label', text: 'на память' },
    w: 0.42,
    ratio: 4,
    layer: 4,
    look: { font: 'neucha', size: 6, fill: '#edc74b' },
    rotation: 3,
  },
  {
    key: 'label-cut',
    title: 'Вырезки',
    content: { kind: 'label', text: 'помню всё' },
    w: 0.7,
    ratio: 2.8,
    layer: 4,
    look: { font: 'cut-news' },
    rotation: -3,
  },
];

function fontLabel(font: SheetFont): Cutout {
  const cut = font.startsWith('cut-');
  return {
    key: `label-${font}`,
    title: 'Надпись',
    content: { kind: 'label', text: cut ? 'тот день' : 'Новая надпись' },
    w: 0.6,
    ratio: cut ? 2.8 : 4.2,
    layer: cut ? 4 : 1,
    look: cut ? { font } : { font, size: font.startsWith('caveat') ? 9 : 6 },
  };
}

const FROM_DAY: {
  title: string;
  content: SheetContent;
  w: number;
  ratio: number;
  layer: number;
}[] = [
  { title: 'Запись', content: { kind: 'text' }, w: 0.75, ratio: 1.6, layer: 4 },
  { title: 'Название', content: { kind: 'sticker', motif: 'title' }, w: 0.8, ratio: 2.9, layer: 4 },
  { title: 'Дата', content: { kind: 'date' }, w: 0.5, ratio: 6.7, layer: 4 },
  { title: 'Настроение', content: { kind: 'mood' }, w: 0.38, ratio: 3.8, layer: 4 },
  { title: 'Погода', content: { kind: 'weather' }, w: 0.3, ratio: 3, layer: 4 },
];

export function TextPanel({ editor }: { editor: Editor }) {
  const same = (content: SheetContent) => (item: SheetItem) =>
    item.kind === content.kind &&
    (content.kind !== 'sticker' || (item.kind === 'sticker' && item.motif === content.motif));
  return (
    <>
      <Section title="Добавить надпись">
        <div className="ed-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className="ed-chip"
              onClick={() => editor.add(preset)}
            >
              + {preset.title}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Из записи">
        <TitleField editor={editor} />
        <div className="ed-chips">
          {FROM_DAY.filter(
            ({ content }) =>
              (content.kind !== 'mood' && content.kind !== 'weather') ||
              editor.base.page.elements.some((e) => e.kind === content.kind),
          ).map(({ title, content, w, ratio, layer }) => {
            const placed = editor.items.find(same(content));
            return (
              <button
                key={title}
                type="button"
                className="ed-chip"
                onClick={() => {
                  if (!placed) return editor.add({ key: title, title, content, w, ratio, layer });
                  editor.reveal(placed.leaf);
                  editor.select([placed.id]);
                }}
              >
                {placed ? title : `+ ${title}`}
              </button>
            );
          })}
        </div>
      </Section>
      <Section title="Шрифты">
        <Fonts onChange={(font) => editor.add(fontLabel(font))} />
      </Section>
    </>
  );
}

const Cutouts = memo(function Cutouts({
  list,
  spec,
  onAdd,
}: {
  list: Cutout[];
  spec: DaySpec;
  onAdd: (cut: Cutout) => void;
}) {
  return (
    <div className="ed-cutouts">
      {list.map((cut) => {
        const url = cut.content.kind === 'image' ? thumbUrl(cut.content.asset) : null;
        return (
          <button
            key={cut.key}
            type="button"
            className="ed-cutout"
            draggable
            title={cut.title}
            aria-label={cut.title}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', cut.key);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => onAdd(cut)}
          >
            {cut.content.kind === 'image' ? (
              <img
                src={url ?? assetUrl(cut.content.asset) ?? undefined}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            ) : (
              <MotifThumb cut={cut} spec={spec} />
            )}
          </button>
        );
      })}
    </div>
  );
});

export function StickerPanel({ editor }: { editor: Editor }) {
  const [group, setGroup] = useState(() => startGroup(editor.base.date));
  const [query, setQuery] = useState('');
  const [alphabet, setAlphabet] = useState<CutAlphabet>('news');
  const [small, setSmall] = useState(false);
  const wanted = query.trim().toLowerCase().replace(/ё/g, 'е');
  const list = useMemo(
    () =>
      wanted
        ? GROUPS.flatMap((g) => g.items).filter((cut) =>
            cut.title.toLowerCase().replace(/ё/g, 'е').includes(wanted),
          )
        : group === 'letters'
          ? LETTERS.map((char) => letter(alphabet, small ? char.toLowerCase() : char))
          : (GROUPS.find((g) => g.id === group)?.items ?? []),
    [wanted, group, alphabet, small],
  );
  const latest = useRef(editor);
  useLayoutEffect(() => {
    latest.current = editor;
  });
  const add = useCallback((cut: Cutout) => latest.current.add(cut), []);
  return (
    <>
      <input
        className="ed-input"
        type="search"
        placeholder="Найти стикер"
        aria-label="Найти стикер"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!wanted && (
        <Chips
          label="Наборы"
          className="ed-groups"
          options={[...GROUPS, { id: 'letters', title: 'Буквы' }]}
          value={group}
          onChange={setGroup}
        />
      )}
      {!wanted && group === 'letters' && (
        <>
          <Chips
            label="Буквы из чего"
            className="ed-groups"
            options={ALPHABETS}
            value={alphabet}
            onChange={setAlphabet}
          />
          <button
            type="button"
            className="ed-chip"
            aria-pressed={small}
            onClick={() => setSmall(!small)}
          >
            строчные
          </button>
        </>
      )}
      <Cutouts list={list} spec={editor.base} onAdd={add} />
      {!list.length && <p className="ed-note">Ничего не нашлось.</p>}
      {list.some((cut) => cut.key.startsWith('image:seasons/')) && (
        <a className="ed-source" href="https://www.freepik.com" target="_blank" rel="noreferrer">
          Designed by Freepik
        </a>
      )}
    </>
  );
}

export function LayersPanel({ editor }: { editor: Editor }) {
  const { items, selected } = editor;
  return (
    <>
      <ResetButtons editor={editor} />
      <ul className="ed-layers">
        {items.toReversed().map((item) => {
          const name = nameOf(item, editor);
          return (
            <li key={item.id} data-selected={selected.includes(item) || undefined}>
              <button
                type="button"
                className="ed-layer"
                onClick={(e) => {
                  const ids = selected.map((picked) => picked.id);
                  editor.reveal(item.leaf);
                  if (e.shiftKey || e.ctrlKey || e.metaKey)
                    editor.select(
                      ids.includes(item.id)
                        ? ids.filter((id) => id !== item.id)
                        : [...ids, item.id],
                    );
                  else editor.select([item.id]);
                }}
              >
                <span>{name}</span>
                <small>{item.leaf === 'left' ? 'слева' : 'справа'}</small>
              </button>
              <IconButton
                name="up"
                label={`${name}: выше`}
                onClick={() => editor.changeItems((all) => restack(all, [item.id], 'up'))}
              />
              <IconButton
                name="down"
                label={`${name}: ниже`}
                onClick={() => editor.changeItems((all) => restack(all, [item.id], 'down'))}
              />
              <IconButton
                name="trash"
                label={`${name}: удалить`}
                onClick={() => editor.remove([item.id])}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}
