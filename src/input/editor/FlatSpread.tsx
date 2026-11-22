import { memo } from 'react';
import { DaySpread } from '../../render/DaySpread';
import type { DaySpec } from '../../types/dayspec';

/** Собранный разворот для редактора и превью: обе страницы рядом, кнопки внутри выключены. */
export const FlatSpread = memo(function FlatSpread({ spec }: { spec: DaySpec }) {
  return (
    <div className="flat-spread" inert>
      <DaySpread spec={spec} />
    </div>
  );
});
