import React from 'react';
import { MissionProvider } from './context/MissionContext';
import { DashboardLayout } from './components/layout';

export const App: React.FC = () => {
  return (
    <MissionProvider>
      <DashboardLayout initialPage="planner" />
    </MissionProvider>
  );
};

export default App;
