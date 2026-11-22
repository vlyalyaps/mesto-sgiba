import { MonthScreen } from './app/MonthScreen';
import { DayScreen } from './app/DayScreen';
import { NewDayScreen } from './app/NewDayScreen';
import { GalleryScreen } from './gallery/GalleryScreen';
import { useRoute } from './app/router';

export default function App() {
  const route = useRoute();
  if (route.name === 'month')
    return (
      <MonthScreen
        key={route.month + route.contents}
        month={route.month}
        contents={route.contents}
      />
    );
  if (route.name === 'day')
    return <DayScreen key={route.id} id={route.id} assembled={route.assembled} />;
  if (route.name === 'new') return <NewDayScreen />;
  // Главный экран — стол со всеми днями; '#/gallery/<id>' раскрывает день на том же столе.
  return <GalleryScreen id={route.name === 'gallery' ? route.id : undefined} />;
}
