import React, { useState } from 'react';
import { Loader2, Database, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { useMission } from '../context/MissionContext';
import { MissionMetricsGrid } from './MissionMetricsGrid';
import { Button } from './ui/Button';

export const MissionMetricsSection: React.FC = () => {
  const { currentSunPosition, currentEarthPosition, timelineSeries } = useMission();
  const [simulateLoading, setSimulateLoading] = useState<boolean>(false);
  const [simulateMissing, setSimulateMissing] = useState<boolean>(false);

  // Evaluate data-source status individually for each subsystem:
  // Live SPICE requires genuine calculated status, real_ephemeris data_mode, non-null values, and not missing.
  const isSolarLive =
    !simulateMissing &&
    !currentSunPosition.isDemoData &&
    currentSunPosition.data_mode === 'real_ephemeris' &&
    currentSunPosition.status === 'calculated' &&
    currentSunPosition.elevation !== null &&
    !isNaN(currentSunPosition.elevation);

  const isEarthLive =
    !simulateMissing &&
    !currentEarthPosition.isDemoData &&
    currentEarthPosition.data_mode === 'real_ephemeris' &&
    currentEarthPosition.status === 'calculated' &&
    currentEarthPosition.elevation !== null &&
    !isNaN(currentEarthPosition.elevation);

  const isTimelineLive =
    !simulateMissing &&
    !timelineSeries.isDemoData &&
    timelineSeries.data_mode === 'real_ephemeris' &&
    timelineSeries.points.length > 0;

  const totalHours = timelineSeries.totalHours || 168;

  const solarEl =
    simulateMissing || isNaN(currentSunPosition.elevation)
      ? null
      : currentSunPosition.elevation;

  const earthEl =
    simulateMissing || isNaN(currentEarthPosition.elevation)
      ? null
      : currentEarthPosition.elevation;

  return (
    <div className="space-y-3">
      {/* Metric Cards Grid Receiving Subsystem-Specific Live/Demo Indicators */}
      <MissionMetricsGrid
        solarElevation={solarEl}
        earthElevation={earthEl}
        sunlightDurationHours={
          simulateMissing ? null : timelineSeries.summary.totalSunlightHours
        }
        commVisibilityDurationHours={
          simulateMissing ? null : timelineSeries.summary.totalCommHours
        }
        totalMissionHours={totalHours}
        isSolarDemo={!isSolarLive}
        isEarthDemo={!isEarthLive}
        isTimelineDemo={!isTimelineLive}
        isLoading={simulateLoading}
        isMissingData={simulateMissing}
      />

      {/* State Verification Toolbar (Loading & Missing States) */}
      <div className="px-3.5 py-2 rounded-lg bg-[#101827] border border-[#263449] flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span className="text-slate-300 font-semibold uppercase">
            Metrics State Verification:
          </span>
          <span className="text-slate-500 hidden sm:inline">
            (Toggle loading skeletons or missing data states)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant={simulateLoading ? 'amber' : 'secondary'}
            onClick={() => {
              setSimulateLoading(!simulateLoading);
              if (simulateMissing) setSimulateMissing(false);
            }}
          >
            <Loader2 className={`w-3 h-3 ${simulateLoading ? 'animate-spin' : ''}`} />
            <span>{simulateLoading ? 'Loading Active' : 'Test Loading State'}</span>
          </Button>

          <Button
            size="xs"
            variant={simulateMissing ? 'warning' : 'secondary'}
            onClick={() => {
              setSimulateMissing(!simulateMissing);
              if (simulateLoading) setSimulateLoading(false);
            }}
          >
            <Database className="w-3 h-3" />
            <span>{simulateMissing ? 'Missing Active' : 'Test Missing Data'}</span>
          </Button>

          {(simulateLoading || simulateMissing) && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setSimulateLoading(false);
                setSimulateMissing(false);
              }}
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MissionMetricsSection;
