// Галерея раньше формы: стили формы уточняют общие стили разворота и должны идти после них.
import { GalleryScreen } from './gallery/GalleryScreen';
import { EditDayScreen, NewDayScreen } from './app/NewDayScreen';
import { useRoute } from './app/router';

export default function App() {
  const route = useRoute();
  if (route.name === 'new') return <NewDayScreen />;
  if (route.name === 'edit') return <EditDayScreen key={route.id} id={route.id} />;
  return <GalleryScreen id={route.id} />;
}
