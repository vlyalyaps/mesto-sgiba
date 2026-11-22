// Галерея раньше формы: стили редактора уточняют общие стили разворота и должны идти после них.
import { GalleryScreen } from './gallery/GalleryScreen';
import { EditDayScreen, NewDayScreen } from './app/NewDayScreen';
import { useRoute } from './app/router';

export default function App() {
  const route = useRoute();
  if (route.name === 'new') return <NewDayScreen />;
  if (route.name === 'edit') return <EditDayScreen key={route.id} id={route.id} />;
  // Тетрадь открывается на своём первом дне, день — сразу на столе.
  if (route.name === 'month') return <GalleryScreen month={route.month} />;
  if (route.name === 'day') return <GalleryScreen id={route.id} />;
  // Главный экран — стол со всеми днями; '#/gallery/<id>' раскрывает день на том же столе.
  return <GalleryScreen id={route.name === 'gallery' ? route.id : undefined} />;
}
