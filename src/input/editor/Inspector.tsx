import { cutFont } from '../../render/sheetStyle';
import type { PieceLook, PrintFrame, SheetItem } from '../../types/sheet';
import { CARRIERS } from './catalog';
import type { Editor } from './context';
import { Chips, IconButton, Section, Slider, Swatches } from './controls';
import { Fonts, TitleField } from './fields';
import { boxOf, LEAF_H, moveTo, restack, withLook, type Restack } from './model';
import { nameOf } from './names';

const FRAMES: { id: PrintFrame; title: string }[] = [
  { id: 'plain', title: 'Отпечаток' },
  { id: 'polaroid', title: 'Полароид' },
  { id: 'none', title: 'Без рамки' },
  { id: 'dark', title: 'Чёрная' },
  { id: 'film', title: 'Плёнка' },
  { id: 'torn', title: 'Рваная' },
  { id: 'stamp', title: 'Марка' },
  { id: 'round', title: 'Скруглённая' },
  { id: 'circle', title: 'Круг' },
  { id: 'arch', title: 'Арка' },
];
const TONES = [
  { id: 'none', title: 'Как есть' },
  { id: 'bw', title: 'Ч/б' },
  { id: 'sepia', title: 'Сепия' },
  { id: 'warm', title: 'Тепло' },
  { id: 'cool', title: 'Холодно' },
  { id: 'faded', title: 'Выцветшее' },
  { id: 'punchy', title: 'Сочно' },
] as const;
const ALIGN = [
  { id: 'left', title: 'Слева' },
  { id: 'center', title: 'По центру' },
  { id: 'right', title: 'Справа' },
] as const;
const BLENDS = [
  { id: 'normal', title: 'Обычное' },
  { id: 'multiply', title: 'В бумагу' },
  { id: 'screen', title: 'Светом' },
  { id: 'overlay', title: 'Контраст' },
] as const;
const TAPES = [
  { id: '#d8c194', title: 'Бумажный' },
  { id: '#24221e', title: 'Чёрный' },
  { id: '#57514a', title: 'В клетку' },
] as const;
const FLAT = new Set(['bent-corner', 'life-pocket']);
/** Готовые картинки: краски и букв, которые можно перекрасить, в них нет. */
const PICTURE =
  /^(binder|black-tape|case|checks|clip|graph|looseleaf|masking|pen-arrow|pen-bolts|pin|punch-stamp|show-stub|tangle-ink|tea-ring|tea-sketch|train-ink|wire-loop|xerox|trail-map|bent-corner|paper-swatches|life-(blot|dried-flower|dried-leaf|newsprint|photo-corner|tape-ghost|vellum|worn-clip)|object-(cup|case|train|clock|mountain|sun|flower|leaf|ticket|moon|camera|arrow))$/;

const degrees = (v: number) => `${Math.round(v)}°`;

/** Настройки выбранного. Изменение вклейки правил само запоминает лист целиком. */
export function Inspector({ editor }: { editor: Editor }) {
  const { selected, spec } = editor;
  const item = selected[0];
  if (!item) return null;
  const ids = selected.map((picked) => picked.id);
  const key = ids.join();
  const one = selected.length === 1;
  const look: PieceLook = item.look ?? {};
  const box = boxOf(item);

  const set = (name: string, next: (item: SheetItem) => SheetItem) =>
    editor.update(ids, next, `${name}:${key}`);
  const style = (patch: Partial<PieceLook>) =>
    set(Object.keys(patch).join(), (picked) => withLook(picked, patch));
  const stack = (to: Restack) => editor.changeItems((items) => restack(items, ids, to));
  const center = (axis: 'x' | 'y') =>
    set(`center-${axis}`, (picked) => {
      const b = boxOf(picked);
      const middle = picked.leaf === 'right' ? 1.5 : 0.5;
      return moveTo(picked, axis === 'x' ? { x: middle, y: b.cy } : { x: b.cx, y: LEAF_H / 2 });
    });

  const isTitle = item.kind === 'sticker' && item.motif === 'title';
  const typed = item.kind === 'label' || item.kind === 'text' || item.kind === 'date' || isTitle;
  const pictured = item.kind === 'photo' || item.kind === 'image' || item.kind === 'sticker';
  // У вырезанных букв нет ни кегля, ни краски: их размер задаёт рамка.
  const lettered = isTitle
    ? !look.font || !!cutFont(look.font)
    : item.kind === 'label' && !!cutFont(look.font);
  const inked =
    !lettered &&
    item.kind !== 'image' &&
    item.kind !== 'tape' &&
    item.kind !== 'photo' &&
    !(item.kind === 'sticker' && PICTURE.test(item.motif));
  const shown = spec.page.elements.find((e) => e.id === item.id);
  const defaultSize = isTitle || item.kind === 'label' ? 7 : item.kind === 'date' ? 3.1 : 5.6;

  return (
    <div className="ed-inspector-body">
      <header className="ed-side-head">
        <h2>{one ? nameOf(item, editor) : `Выбрано: ${selected.length}`}</h2>
        <IconButton name="close" label="Снять выделение" onClick={() => editor.select([])} />
      </header>
      <div className="ed-actions" role="toolbar" aria-label="Действия с деталью">
        <IconButton name="copy" label="Дублировать" onClick={() => editor.duplicate(ids)} />
        <IconButton name="top" label="На самый верх" onClick={() => stack('top')} />
        <IconButton name="up" label="Слой выше" onClick={() => stack('up')} />
        <IconButton name="down" label="Слой ниже" onClick={() => stack('down')} />
        <IconButton name="bottom" label="В самый низ" onClick={() => stack('bottom')} />
        <IconButton
          name="flip"
          label="Отразить"
          pressed={!!look.flip}
          onClick={() => style({ flip: look.flip ? undefined : true })}
        />
        <IconButton
          name="trash"
          label="Удалить с листа"
          className="ed-danger"
          onClick={() => editor.remove(ids)}
        />
      </div>

      {one && item.kind === 'label' && (
        <div className="ed-field">
          <textarea
            className="ed-input ed-label-text"
            aria-label="Текст надписи"
            rows={2}
            maxLength={2000}
            value={item.text}
            onChange={(e) => {
              const text = e.target.value;
              set('words', (picked) => (picked.kind === 'label' ? { ...picked, text } : picked));
            }}
          />
        </div>
      )}
      {one && isTitle && <TitleField editor={editor} />}
      {one && shown?.kind === 'text' && shown.sentences.length > 1 && (
        <Section title="Главная фраза">
          <div className="ed-phrases">
            {shown.sentences.map((sentence, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={spec.key.sentence === i}
                onClick={() => editor.setEdits({ keySentence: i })}
              >
                {sentence}
              </button>
            ))}
            {editor.edits.keySentence !== undefined && (
              <button
                type="button"
                className="ed-link"
                onClick={() => editor.setEdits({ keySentence: undefined })}
              >
                Пусть выбирают правила
              </button>
            )}
          </div>
        </Section>
      )}

      {one && typed && (
        <>
          <Section title="Шрифт">
            <Fonts
              value={look.font}
              cut={item.kind === 'label' || isTitle}
              onChange={(font) => style({ font })}
            />
          </Section>
          {!lettered && (
            <Section title="Набор">
              <Slider
                label="Кегль"
                min={1.5}
                max={26}
                step={0.1}
                value={look.size ?? defaultSize}
                show={(v) => v.toFixed(1).replace('.', ',')}
                onChange={(size) => style({ size })}
              />
              <Chips
                label="Выключка"
                options={ALIGN}
                value={look.align}
                onChange={(align) => style({ align: look.align === align ? undefined : align })}
              />
              <Slider
                label="Строки"
                min={0.7}
                max={2}
                value={look.lineHeight ?? 1.05}
                show={(v) => v.toFixed(2).replace('.', ',')}
                onChange={(lineHeight) => style({ lineHeight })}
              />
              <Slider
                label="Разрядка"
                min={-0.1}
                max={0.6}
                value={look.spacing ?? 0}
                show={(v) => v.toFixed(2).replace('.', ',')}
                onChange={(spacing) => style({ spacing })}
              />
              <button
                type="button"
                className="ed-chip"
                aria-pressed={!!look.upper}
                onClick={() => style({ upper: look.upper ? undefined : true })}
              >
                ПРОПИСНЫЕ
              </button>
            </Section>
          )}
        </>
      )}

      {one && item.kind === 'photo' && (
        <>
          <Section title="Рамка">
            <Chips
              label="Рамка"
              options={FRAMES}
              value={look.frame ?? 'plain'}
              onChange={(frame) => style({ frame: frame === 'plain' ? undefined : frame })}
            />
          </Section>
          <Section title="Кадр">
            <Slider
              label="Приближение"
              min={1}
              max={4}
              value={look.zoom ?? 1}
              show={(v) => `${v.toFixed(1).replace('.', ',')}×`}
              onChange={(zoom) => style({ zoom })}
            />
            {(['x', 'y'] as const).map((axis) => {
              const crop = spec.photos.find((p) => p.photoId === item.photoId)?.crop;
              const auto = {
                x: crop ? crop.x + crop.w / 2 : 0.5,
                y: crop ? crop.y + crop.h / 2 : 0.5,
              };
              return (
                <Slider
                  key={axis}
                  label={axis === 'x' ? 'Влево — вправо' : 'Вверх — вниз'}
                  min={0}
                  max={1}
                  value={(look.pan ?? auto)[axis]}
                  onChange={(v) => style({ pan: { ...(look.pan ?? auto), [axis]: v } })}
                />
              );
            })}
            <button
              type="button"
              className="ed-chip"
              aria-pressed={spec.photos.some((p) => p.photoId === item.photoId && p.role === 'key')}
              onClick={() => editor.setEdits({ keyPhotoId: item.photoId })}
            >
              ★ Главный кадр
            </button>
          </Section>
          <Section title="Подпись">
            <input
              className="ed-input"
              aria-label="Подпись на снимке"
              maxLength={500}
              value={item.caption ?? (shown?.kind === 'photo' ? (shown.caption ?? '') : '')}
              onChange={(e) => {
                const caption = e.target.value;
                set('caption', (picked) =>
                  picked.kind === 'photo' ? { ...picked, caption } : picked,
                );
              }}
            />
          </Section>
        </>
      )}

      {one && item.kind === 'ticket' && (
        <Section title="Носитель">
          <Chips
            label="Носитель песни"
            options={CARRIERS}
            value={shown?.kind === 'ticket' ? shown.carrier : undefined}
            onChange={(carrier) =>
              set('carrier', (picked) =>
                picked.kind === 'ticket' ? { ...picked, carrier } : picked,
              )
            }
          />
        </Section>
      )}
      {one && item.kind === 'tape' && (
        <Section title="Скотч">
          <Chips
            label="Вид скотча"
            options={TAPES}
            value={TAPES.find((tape) => tape.id === item.color)?.id ?? '#d8c194'}
            onChange={(color) => set('tape', (picked) => ({ ...picked, color }))}
          />
        </Section>
      )}

      {inked && (
        <Section title="Цвет">
          <Swatches
            label="Цвет"
            palette={editor.palette}
            value={look.color}
            onChange={(color) => style({ color })}
          />
        </Section>
      )}
      {(typed || item.kind === 'mood' || item.kind === 'weather') && (
        <Section title="Подложка">
          <Swatches
            label="Подложка"
            reset="Без подложки"
            palette={editor.palette}
            value={look.fill}
            onChange={(fill) => style({ fill })}
          />
        </Section>
      )}
      {pictured && !isTitle && (
        <Section title="Обработка">
          <Chips
            label="Обработка"
            options={TONES}
            value={look.tone ?? 'none'}
            onChange={(tone) => style({ tone: tone === 'none' ? undefined : tone })}
          />
          <Slider
            label="Яркость"
            min={0.3}
            max={1.8}
            value={look.brightness ?? 1}
            onChange={(brightness) => style({ brightness })}
          />
          <Slider
            label="Контраст"
            min={0.3}
            max={2}
            value={look.contrast ?? 1}
            onChange={(contrast) => style({ contrast })}
          />
          <Slider
            label="Насыщенность"
            min={0}
            max={2.5}
            value={look.saturation ?? 1}
            onChange={(saturation) => style({ saturation })}
          />
          <Slider
            label="Оттенок"
            min={-180}
            max={180}
            step={1}
            show={degrees}
            value={look.hue ?? 0}
            onChange={(hue) => style({ hue })}
          />
        </Section>
      )}

      <Section title="Размер и место">
        {one && (
          <>
            <Slider
              label="Размер"
              min={0.2}
              max={Math.max(3, item.scale)}
              value={item.scale}
              onChange={(scale) => set('scale', (picked) => ({ ...picked, scale }))}
            />
            <Slider
              label="Ширина"
              min={0.02}
              max={Math.max(1.5, box.w)}
              value={box.w}
              onChange={(w) =>
                set('width', (picked) => {
                  const b = boxOf(picked);
                  return moveTo({ ...picked, w: w / picked.scale }, { x: b.cx, y: b.cy });
                })
              }
            />
            <Slider
              label="Высота"
              min={0.02}
              max={Math.max(1.2, box.h / LEAF_H)}
              value={box.h / LEAF_H}
              onChange={(h) =>
                set('height', (picked) => {
                  const b = boxOf(picked);
                  return moveTo({ ...picked, h: h / picked.scale }, { x: b.cx, y: b.cy });
                })
              }
            />
          </>
        )}
        <Slider
          label="Поворот"
          min={-180}
          max={180}
          step={1}
          show={degrees}
          value={item.rotation}
          onChange={(rotation) => set('rotation', (picked) => ({ ...picked, rotation }))}
        />
        <div className="ed-row">
          <IconButton
            name="centerX"
            label="По центру страницы по горизонтали"
            onClick={() => center('x')}
          />
          <IconButton
            name="centerY"
            label="По центру страницы по вертикали"
            onClick={() => center('y')}
          />
        </div>
      </Section>
      <Section title="Наложение">
        <Slider
          label="Непрозрачность"
          min={0}
          max={1}
          value={look.opacity ?? 1}
          onChange={(opacity) => style({ opacity })}
        />
        {!(item.kind === 'sticker' && FLAT.has(item.motif)) && (
          <Slider
            label="Тень"
            min={0}
            max={1}
            value={look.shadow ?? (item.layer >= 2 ? 0.25 : 0)}
            onChange={(shadow) => style({ shadow })}
          />
        )}
        <Chips
          label="Наложение"
          options={BLENDS}
          value={look.blend}
          onChange={(blend) => style({ blend: look.blend === blend ? undefined : blend })}
        />
        {spec.song && (
          <Slider
            label="Появляется под музыку"
            min={0}
            max={1}
            value={item.at}
            onChange={(at) => set('at', (picked) => ({ ...picked, at }))}
          />
        )}
      </Section>
    </div>
  );
}
