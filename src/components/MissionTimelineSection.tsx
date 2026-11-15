import React from 'react';
import { useMission } from '../context/MissionContext';
import { MissionTimeline } from './MissionTimeline';

export const MissionTimelineSection: React.FC = () => {
  const { timelineSeries, currentTimelineStep, setCurrentTimelineStep } = useMission();

  return (
    <MissionTimeline
      series={timelineSeries}
      currentStepIndex={currentTimelineStep}
      onStepChange={setCurrentTimelineStep}
      isDemoData={true}
    />
  );
};

export default MissionTimelineSection;
