import React from 'react';
import { Sun, Globe, Clock, Radio } from 'lucide-react';
import { MetricCard } from './MetricCard';

export interface MissionMetricsGridProps {
  solarElevation?: number | null;
  earthElevation?: number | null;
  sunlightDurationHours?: number | null;
  commVisibilityDurationHours?: number | null;
  totalMissionHours?: number;
  solarStatusText?: string;
  earthStatusText?: string;
  /** Legacy/fallback demo indicator applied to all cards when granular flags are omitted */
  isDemoData?: boolean;
  /** Subsystem-specific indicator for solar elevation data source */
  isSolarDemo?: boolean;
  /** Subsystem-specific indicator for Earth line-of-sight elevation data source */
  isEarthDemo?: boolean;
  /** Subsystem-specific indicator for time-series / window duration evaluation data source */
  isTimelineDemo?: boolean;
  isLoading?: boolean;
  isMissingData?: boolean;
  className?: string;
}

export const MissionMetricsGrid: React.FC<MissionMetricsGridProps> = ({
  solarElevation,
  earthElevation,
  sunlightDurationHours,
  commVisibilityDurationHours,
  totalMissionHours = 168,
  solarStatusText,
  earthStatusText,
  isDemoData = true,
  isSolarDemo,
  isEarthDemo,
  isTimelineDemo,
  isLoading = false,
  isMissingData = false,
  className = '',
}) => {
  // Resolve granular demo flags with fallback to general isDemoData
  const resolvedSolarDemo = isSolarDemo !== undefined ? isSolarDemo : isDemoData;
  const resolvedEarthDemo = isEarthDemo !== undefined ? isEarthDemo : isDemoData;
  const resolvedTimelineDemo = isTimelineDemo !== undefined ? isTimelineDemo : isDemoData;
  // Determine solar status from inputs (strictly safeguarding against NaN)
  const getSolarStatus = () => {
    if (solarElevation === null || solarElevation === undefined || isNaN(solarElevation)) {
      return { status: 'neutral' as const, text: 'Unavailable' };
    }
    if (solarElevation >= 0) return { status: 'active' as const, text: 'Above 0° (Geometric Horizon)' };
    return { status: 'warning' as const, text: 'Sub-Horizon (Dark)' };
  };

  // Determine earth status from inputs (strictly safeguarding against NaN)
  const getEarthStatus = () => {
    if (earthElevation === null || earthElevation === undefined || isNaN(earthElevation)) {
      return { status: 'neutral' as const, text: 'Unavailable' };
    }
    if (earthElevation >= 0) return { status: 'nominal' as const, text: 'Above 0° (Geometric LOS Open)' };
    return { status: 'warning' as const, text: 'Sub-Horizon (No Link)' };
  };

  const solarStatus = getSolarStatus();
  const earthStatus = getEarthStatus();
  const totalDays = Math.max(1, Math.round(totalMissionHours / 24));

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {/* 1. Solar Elevation Metric Card */}
      <MetricCard
        title="Solar Elevation"
        value={solarElevation}
        unit="°"
        subtitle="Instantaneous Topocentric Horizon (0° Datum)"
        accentColor="amber"
        icon={Sun}
        status={solarStatus.status}
        statusText={solarStatusText || solarStatus.text}
        isLoading={isLoading}
        isMissingData={isMissingData || solarElevation === null || (typeof solarElevation === 'number' && isNaN(solarElevation))}
        isDemoData={resolvedSolarDemo}
      />

      {/* 2. Earth Elevation Metric Card */}
      <MetricCard
        title="Earth Elevation"
        value={earthElevation}
        unit="°"
        subtitle="Instantaneous Direct-To-Earth (DTE) LOS"
        accentColor="blue"
        icon={Globe}
        status={earthStatus.status}
        statusText={earthStatusText || earthStatus.text}
        isLoading={isLoading}
        isMissingData={isMissingData || earthElevation === null || (typeof earthElevation === 'number' && isNaN(earthElevation))}
        isDemoData={resolvedEarthDemo}
      />

      {/* 3. Sunlight Duration Metric Card */}
      <MetricCard
        title="Sunlight Duration"
        value={
          sunlightDurationHours !== null && sunlightDurationHours !== undefined && !isNaN(sunlightDurationHours)
            ? `${sunlightDurationHours.toFixed(1)}h`
            : null
        }
        unit={
          sunlightDurationHours !== null && sunlightDurationHours !== undefined && !isNaN(sunlightDurationHours) && totalMissionHours > 0
            ? `(${((sunlightDurationHours / totalMissionHours) * 100).toFixed(1)}%)`
            : undefined
        }
        subtitle={`${totalDays}-Day Evaluation Window (${totalMissionHours}h Total)`}
        accentColor="cyan"
        icon={Clock}
        status={
          sunlightDurationHours !== null && sunlightDurationHours !== undefined && !isNaN(sunlightDurationHours)
            ? sunlightDurationHours >= totalMissionHours * 0.6
              ? 'nominal'
              : 'caution'
            : 'neutral'
        }
        statusText={
          sunlightDurationHours !== null && sunlightDurationHours !== undefined && !isNaN(sunlightDurationHours) && totalMissionHours > 0
            ? `${((sunlightDurationHours / totalMissionHours) * 100).toFixed(0)}% Surface Sunlit`
            : undefined
        }
        isLoading={isLoading}
        isMissingData={isMissingData}
        isDemoData={resolvedTimelineDemo}
      />

      {/* 4. Communication Visibility Duration Metric Card */}
      <MetricCard
        title="Communication Visibility Duration"
        value={
          commVisibilityDurationHours !== null && commVisibilityDurationHours !== undefined && !isNaN(commVisibilityDurationHours)
            ? `${commVisibilityDurationHours.toFixed(1)}h`
            : null
        }
        unit={
          commVisibilityDurationHours !== null && commVisibilityDurationHours !== undefined && !isNaN(commVisibilityDurationHours) && totalMissionHours > 0
            ? `(${((commVisibilityDurationHours / totalMissionHours) * 100).toFixed(1)}%)`
            : undefined
        }
        subtitle={`Direct Link Availability (${totalMissionHours}h Total)`}
        accentColor="success"
        icon={Radio}
        status={
          commVisibilityDurationHours !== null && commVisibilityDurationHours !== undefined && !isNaN(commVisibilityDurationHours)
            ? commVisibilityDurationHours >= totalMissionHours * 0.75
              ? 'nominal'
              : 'caution'
            : 'neutral'
        }
        statusText={
          commVisibilityDurationHours !== null && commVisibilityDurationHours !== undefined && !isNaN(commVisibilityDurationHours) && totalMissionHours > 0
            ? `${((commVisibilityDurationHours / totalMissionHours) * 100).toFixed(0)}% DTE Visibility`
            : undefined
        }
        isLoading={isLoading}
        isMissingData={isMissingData}
        isDemoData={resolvedTimelineDemo}
      />
    </div>
  );
};

export default MissionMetricsGrid;
