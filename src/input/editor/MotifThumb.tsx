import { memo, type CSSProperties } from 'react';
import { LifeScan, PaperTrace } from '../../render/PaperLife';
import { Scrap } from '../../render/Scrap';
import { isPaperTrace } from '../../rules/paperLife';
import type { DaySpec } from '../../types/dayspec';
import type { Cutout } from './catalog';

/** Ширина воображаемого листа: рисунки набраны в cqw и в списке должны сохранить пропорции. */
const LEAF = 300;
const THUMB = 64;
/** На листе это кнопки, а список сам из кнопок: в нём показываем только картинку. */
const PRESSABLE = new Set(['life-folded', 'life-sticky', 'life-pocket']);

export const MotifThumb = memo(function MotifThumb({ cut, spec }: { cut: Cutout; spec: DaySpec }) {
  if (cut.content.kind !== 'sticker') return null;
  const { motif } = cut.content;
  const w = cut.w * LEAF;
  const h = w / cut.ratio;
  const ink = /^(ink-|pencil-)/.test(motif);
  return (
    <span className="ed-motif" inert style={{ '--fit': THUMB / Math.max(w, h) } as CSSProperties}>
      <span className="ed-motif-leaf diary-leaf">
        <span
          className={`ed-motif-piece${ink ? ' diary-ink' : ''}${motif === 'receipt' ? ' tea-receipt' : ''}`}
          style={{ width: w, height: h }}
        >
          {PRESSABLE.has(motif) ? (
            <span className="paper-trace">
              <LifeScan name={motif.slice(5)} />
            </span>
          ) : motif.startsWith('life-') || isPaperTrace(motif) ? (
            <PaperTrace motif={motif} spec={spec} />
          ) : (
            <Scrap motif={motif} spec={spec} />
          )}
        </span>
      </span>
    </span>
  );
});
