import { useLayoutEffect, useRef } from 'react';
import type { DaySpec, PhotoSlot } from '../types/dayspec';
import { formatDate } from './format';

export interface ZoomTarget {
  photo: PhotoSlot;
  button: HTMLButtonElement;
}
export function PrintZoom({
  target,
  spec,
  onClose,
}: {
  target: ZoomTarget;
  spec: DaySpec;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const print = useRef<HTMLElement>(null);
  const closing = useRef(false);
  function animate(back = false) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !print.current) return;
    const from = target.button.getBoundingClientRect(),
      to = print.current.getBoundingClientRect();
    const transform = `translate(${from.x + from.width / 2 - to.x - to.width / 2}px,${from.y + from.height / 2 - to.y - to.height / 2}px) scale(${from.width / to.width})`;
    return print.current.animate([{ transform }, { transform: 'none' }], {
      duration: 310,
      easing: 'cubic-bezier(.19,.85,.23,1)',
      direction: back ? 'reverse' : 'normal',
    });
  }
  useLayoutEffect(() => {
    const el = dialog.current!;
    el.showModal();
    const motion = animate();
    return () => {
      motion?.cancel();
      el.close();
      target.button.focus({ preventScroll: true });
    };
  }, [target]);
  function close() {
    if (closing.current) return;
    closing.current = true;
    const motion = animate(true);
    if (motion) motion.onfinish = onClose;
    else onClose();
  }
  return (
    <dialog
      className="print-dialog"
      ref={dialog}
      aria-label="Фотография крупно"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      <button className="zoom-close" onClick={close} aria-label="Закрыть фотографию">
        ×
      </button>
      <figure className="zoom-paper" ref={print}>
        <img src={target.photo.src} alt={spec.folderName} />
        <figcaption>
          <small>
            {formatDate(spec.date)} · снимок {spec.photos.indexOf(target.photo) + 1}
          </small>
          {spec.key.text}
        </figcaption>
      </figure>
    </dialog>
  );
}
