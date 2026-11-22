import { useEffect, useRef } from 'react';
import { DaySpread } from '../../render/DaySpread';
import { useAssembly } from '../../render/useAssembly';
import type { DaySpec } from '../../types/dayspec';
import { IconButton } from './controls';
import { Surroundings } from './Surroundings';

/** Как лист соберётся у зрителя. Звук — только по нажатию. */
export function SheetPreview({ spec, onClose }: { spec: DaySpec; onClose: () => void }) {
  const show = useAssembly(spec);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    root.current?.focus();
  }, []);
  const song = spec.song;
  const busy = show.mode === 'playing' || show.mode === 'loading';
  return (
    <div
      className="ed-show"
      ref={root}
      tabIndex={-1}
      role="group"
      aria-label="Как соберётся лист"
      data-light={spec.page.sheet?.scene.light || undefined}
    >
      <Surroundings spec={spec} />
      <div className="ed-show-book flat-spread">
        <div className="ed-window">
          <DaySpread spec={spec} root={show.root} assembling={show.assembling} />
        </div>
      </div>
      <div className="ed-show-bar">
        {song && (song.trackId || song.previewUrl) && (
          <button type="button" className="ed-done" onClick={() => void show.sound()}>
            {busy ? 'Стоп' : '▶ Со звуком'}
          </button>
        )}
        <IconButton name="replay" label="Собрать ещё раз" onClick={show.silent} />
        {song?.trackViewUrl && (
          <a className="ed-source" href={song.trackViewUrl} target="_blank" rel="noreferrer">
            Apple Music ↗ provided courtesy of iTunes
          </a>
        )}
        {show.notice && <p role="status">{show.notice}</p>}
      </div>
      <IconButton
        name="close"
        label="Вернуться к редактору"
        className="ed-show-close"
        onClick={onClose}
      />
    </div>
  );
}
