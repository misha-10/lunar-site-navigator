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
  isDemoData?: boolean;
  isLoading?: boolean;
  isMissingData?: boolean;
  className?: string;
}

export const MissionMetricsGrid: React.FC<MissionMetricsGridProps> = ({
  solarElevation,
  earthElevation,
  sunlightDurationHours,
  commVisibilityDurationHours,
  totalMissionHours = 336,
  solarStatusText,
  earthStatusText,
  isDemoData = true,
  isLoading = false,
  isMissingData = false,
  className = '',
}) => {
  // Determine solar status from inputs
  const getSolarStatus = () => {
    if (solarElevation === null || solarElevation === undefined) return { status: 'neutral' as const, text: 'No Data' };
    if (solarElevation >= 0) return { status: 'active' as const, text: 'Above 0° (Sunlit)' };
    return { status: 'warning' as const, text: 'Sub-Horizon (Dark)' };
  };

  // Determine earth status from inputs
  const getEarthStatus = () => {
    if (earthElevation === null || earthElevation === undefined) return { status: 'neutral' as const, text: 'No Data' };
    if (earthElevation >= 0) return { status: 'nominal' as const, text: 'LOS Open (Direct Link)' };
    return { status: 'warning' as const, text: 'Sub-Horizon (No Link)' };
  };

  const solarStatus = getSolarStatus();
  const earthStatus = getEarthStatus();

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {/* 1. Solar Elevation Metric Card */}
      <MetricCard
        title="Solar Elevation"
        value={solarElevation}
        unit="°"
        subtitle="Local Horizon Tangent Plane (0° Datum)"
        accentColor="amber"
        icon={Sun}
        status={solarStatus.status}
        statusText={solarStatusText || solarStatus.text}
        isLoading={isLoading}
        isMissingData={isMissingData}
        isDemoData={isDemoData}
      />

      {/* 2. Earth Elevation Metric Card */}
      <MetricCard
        title="Earth Elevation"
        value={earthElevation}
        unit="°"
        subtitle="Direct-To-Earth (DTE) Line of Sight"
        accentColor="blue"
        icon={Globe}
        status={earthStatus.status}
        statusText={earthStatusText || earthStatus.text}
        isLoading={isLoading}
        isMissingData={isMissingData}
        isDemoData={isDemoData}
      />

      {/* 3. Sunlight Duration Metric Card */}
      <MetricCard
        title="Sunlight Duration"
        value={
          sunlightDurationHours !== null && sunlightDurationHours !== undefined
            ? `${sunlightDurationHours.toFixed(1)}h`
            : null
        }
        unit={
          sunlightDurationHours !== null && sunlightDurationHours !== undefined
            ? `(${((sunlightDurationHours / totalMissionHours) * 100).toFixed(1)}%)`
            : undefined
        }
        subtitle={`14-Day Artemis Window (${totalMissionHours}h Total)`}
        accentColor="cyan"
        icon={Clock}
        status={
          sunlightDurationHours !== null && sunlightDurationHours !== undefined
            ? sunlightDurationHours >= 200
              ? 'nominal'
              : 'caution'
            : 'neutral'
        }
        statusText={
          sunlightDurationHours !== null && sunlightDurationHours !== undefined
            ? `${((sunlightDurationHours / totalMissionHours) * 100).toFixed(0)}% Surface Sunlit`
            : undefined
        }
        isLoading={isLoading}
        isMissingData={isMissingData}
        isDemoData={isDemoData}
      />

      {/* 4. Communication Visibility Duration Metric Card */}
      <MetricCard
        title="Communication Visibility Duration"
        value={
          commVisibilityDurationHours !== null && commVisibilityDurationHours !== undefined
            ? `${commVisibilityDurationHours.toFixed(1)}h`
            : null
        }
        unit={
          commVisibilityDurationHours !== null && commVisibilityDurationHours !== undefined
            ? `(${((commVisibilityDurationHours / totalMissionHours) * 100).toFixed(1)}%)`
            : undefined
        }
        subtitle={`Direct Link Availability (${totalMissionHours}h Total)`}
        accentColor="success"
        icon={Radio}
        status={
          commVisibilityDurationHours !== null && commVisibilityDurationHours !== undefined
            ? commVisibilityDurationHours >= 250
              ? 'nominal'
              : 'caution'
            : 'neutral'
        }
        statusText={
          commVisibilityDurationHours !== null && commVisibilityDurationHours !== undefined
            ? `${((commVisibilityDurationHours / totalMissionHours) * 100).toFixed(0)}% DTE Visibility`
            : undefined
        }
        isLoading={isLoading}
        isMissingData={isMissingData}
        isDemoData={isDemoData}
      />
    </div>
  );
};

export default MissionMetricsGrid;
