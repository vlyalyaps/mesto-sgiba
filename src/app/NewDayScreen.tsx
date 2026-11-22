import { useEffect, useState } from 'react';
import { getDay, saveDay, type StoredDay } from '../archive/db';
import { releaseDraft } from '../input/backGuard';
import { DayForm } from '../input/DayForm';
import { dayId } from '../rules';
import { Skeleton } from '../ui/Skeleton';
import { nextDayNumber } from './days';
import { routeHref, type Route } from './router';

/** Редактор в истории не остаётся: «назад» из сохранённого дня не открывает пустую запись. */
async function leaveTo(route: Route) {
  await releaseDraft();
  window.location.replace(routeHref(route));
}

/** «Записать день» сразу открывает редактор листа. */
export function NewDayScreen() {
  const [nextNumber, setNextNumber] = useState(1);

  useEffect(() => {
    void nextDayNumber().then(setNextNumber);
  }, []);

  return (
    <DayForm
      nextNumber={nextNumber}
      onCancel={() => void leaveTo({ name: 'gallery' })}
      onDone={(input, photos) => {
        const id = dayId(input.date, input.number);
        return saveDay({ id, input, photos, createdAt: Date.now() }).then(() =>
          leaveTo({ name: 'gallery', id }),
        );
      }}
    />
  );
}

/** Свой день можно дооформить: тот же редактор, номер и дата прежние. */
export function EditDayScreen({ id }: { id: string }) {
  // undefined — ещё читаем, null — такого дня нет.
  const [day, setDay] = useState<StoredDay | null>();

  useEffect(() => {
    let live = true;
    getDay(id)
      .catch(() => undefined)
      .then((found) => {
        if (live) setDay(found ?? null);
      });
    return () => {
      live = false;
    };
  }, [id]);

  if (day) {
    const back = () => leaveTo({ name: 'gallery', id });
    return (
      <DayForm
        initial={day}
        nextNumber={day.input.number}
        onCancel={() => void back()}
        onDone={(input, photos) => saveDay({ ...day, input, photos }).then(back)}
      />
    );
  }
  return (
    <main className="day-load" aria-busy={day === undefined}>
      {day === undefined ? (
        <Skeleton className="day-wait" />
      ) : (
        <p className="day-none">
          Изменить можно только свой день. <a href={routeHref({ name: 'gallery' })}>Ко всем дням</a>
        </p>
      )}
    </main>
  );
}
