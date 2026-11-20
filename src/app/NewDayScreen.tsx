import { useEffect, useState } from 'react';
import { saveDay } from '../archive/db';
import { DayForm } from '../input/DayForm';
import { dayId } from '../rules';
import { nextDayNumber } from './days';
import { routeHref } from './router';

export function NewDayScreen() {
  const [nextNumber, setNextNumber] = useState(1);

  useEffect(() => {
    void nextDayNumber().then(setNextNumber);
  }, []);

  return (
    <main className="new-day">
      <DayForm
        nextNumber={nextNumber}
        onCancel={() => {
          window.location.hash = routeHref({ name: 'archive' });
        }}
        onDone={(input, photos) => {
          const id = dayId(input.date, input.number);
          void saveDay({ id, input, photos, createdAt: Date.now() }).then(() => {
            window.location.hash = routeHref({ name: 'day', id });
          });
        }}
      />
    </main>
  );
}
