import { MonthScreen } from './app/MonthScreen';
import { ArchiveScreen } from './app/ArchiveScreen';
import { DayScreen } from './app/DayScreen';
import { NewDayScreen } from './app/NewDayScreen';
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
  return <ArchiveScreen />;
}
