import { ArchiveScreen } from './app/ArchiveScreen';
import { DayScreen } from './app/DayScreen';
import { NewDayScreen } from './app/NewDayScreen';
import { useRoute } from './app/router';

export default function App() {
  const route = useRoute();
  if (route.name === 'day') return <DayScreen key={route.id} id={route.id} />;
  if (route.name === 'new') return <NewDayScreen />;
  return <ArchiveScreen />;
}
