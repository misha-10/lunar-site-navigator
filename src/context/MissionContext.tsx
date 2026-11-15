import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type {
  LunarSite,
  MissionContextValue,
  MissionValidationState,
  CelestialPosition,
  TimelineDataPoint,
  SiteTimelineSeries,
} from '../types/mission';
import {
  LUNAR_DEMONSTRATION_SITES,
  DEFAULT_LUNAR_SITE,
} from '../data/lunarSites';
import {
  DEMONSTRATION_TIMELINE_SERIES,
  generateSiteTimelineSeries,
} from '../data/demonstrationTimeline';

const MissionContext = createContext<MissionContextValue | undefined>(undefined);

export interface MissionProviderProps {
  children: React.ReactNode;
  initialSite?: LunarSite;
  initialDate?: string;
  initialTime?: string;
  initialStepIndex?: number;
}

export const MissionProvider: React.FC<MissionProviderProps> = ({
  children,
  initialSite = DEFAULT_LUNAR_SITE,
  initialDate = '2026-10-15',
  initialTime = '12:00',
  initialStepIndex = 12,
}) => {
  const [selectedSite, setSelectedSite] = useState<LunarSite>(initialSite);
  const [currentTimelineStep, setCurrentTimelineStepState] = useState<number>(initialStepIndex);
  const [missionDate, setMissionDateState] = useState<string>(initialDate);
  const [missionTime, setMissionTimeState] = useState<string>(initialTime);
  const [isCustomSite, setIsCustomSite] = useState<boolean>(false);
  const [customCoordinates, setCustomCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Retrieve or generate full 14-day timeline series for active landing site
  const timelineSeries = useMemo<SiteTimelineSeries>(() => {
    if (DEMONSTRATION_TIMELINE_SERIES[selectedSite.id]) {
      return DEMONSTRATION_TIMELINE_SERIES[selectedSite.id];
    }
    return generateSiteTimelineSeries(selectedSite.id);
  }, [selectedSite.id]);

  // Current timeline step point
  const currentTimelinePoint = useMemo<TimelineDataPoint>(() => {
    const clampedIndex = Math.max(
      0,
      Math.min(currentTimelineStep, timelineSeries.points.length - 1)
    );
    return (
      timelineSeries.points[clampedIndex] ||
      timelineSeries.points[0]
    );
  }, [currentTimelineStep, timelineSeries]);

  // Dynamic Sun & Earth celestial positions synchronized with the active timeline step
  const currentSunPosition = useMemo<CelestialPosition>(() => ({
    azimuth: currentTimelinePoint.sunAzimuth,
    elevation: currentTimelinePoint.sunElevation ?? 0,
    terrainElevationAtAzimuth: currentTimelinePoint.terrainElevationAtSunAz,
    isDemoData: true,
  }), [currentTimelinePoint]);

  const currentEarthPosition = useMemo<CelestialPosition>(() => ({
    azimuth: currentTimelinePoint.earthAzimuth,
    elevation: currentTimelinePoint.earthElevation ?? 0,
    terrainElevationAtAzimuth: currentTimelinePoint.terrainElevationAtEarthAz,
    isDemoData: true,
  }), [currentTimelinePoint]);

  // Validate date and time inputs
  const validateDateTime = useCallback(
    (dateStr: string, timeStr: string): { isValid: boolean; errorDate?: string; errorTime?: string } => {
      let isValid = true;
      let errorDate: string | undefined;
      let errorTime: string | undefined;

      // Validate Date format YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateStr)) {
        isValid = false;
        errorDate = 'Format must be YYYY-MM-DD';
      } else {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) {
          isValid = false;
          errorDate = 'Invalid calendar date';
        }
      }

      // Validate Time format HH:mm
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(timeStr)) {
        isValid = false;
        errorTime = 'Format must be HH:mm (24-hour UTC)';
      }

      return { isValid, errorDate, errorTime };
    },
    []
  );

  // Computed ISO 8601 UTC Timestamp
  const selectedTimestampUtc = useMemo(() => {
    try {
      const dt = new Date(`${missionDate}T${missionTime}:00Z`);
      if (!isNaN(dt.getTime())) {
        return dt.toISOString();
      }
    } catch {
      // Fallback
    }
    return `${missionDate}T${missionTime}:00.000Z`;
  }, [missionDate, missionTime]);

  // Overall Validation State
  const validation = useMemo<MissionValidationState>(() => {
    const dtVal = validateDateTime(missionDate, missionTime);
    const errors: MissionValidationState['errors'] = {};
    const warnings: string[] = [];

    if (dtVal.errorDate) errors.date = dtVal.errorDate;
    if (dtVal.errorTime) errors.time = dtVal.errorTime;

    // Validate Latitude: Lunar South Pole region is between -90° and -80°
    if (selectedSite.latitude < -90.0 || selectedSite.latitude > -80.0) {
      errors.latitude =
        'South polar operational latitude must be between -90.00° and -80.00°S';
    }

    // Validate Longitude: 0° to 360° (or -180° to +180°)
    if (selectedSite.longitude < 0.0 || selectedSite.longitude > 360.0) {
      errors.longitude = 'Longitude must be between 0.00° and 360.00° East';
    }

    if (!selectedSite.isVerified) {
      warnings.push(
        'Custom coordinates are unverified approximate demonstration coordinates.'
      );
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings,
    };
  }, [missionDate, missionTime, selectedSite, validateDateTime]);

  // Actions
  const setCurrentTimelineStep = useCallback((stepIndex: number) => {
    const safeIndex = Math.max(0, Math.min(stepIndex, 335));
    setCurrentTimelineStepState(safeIndex);

    // Synchronize missionDate and missionTime with this timeline point
    const startDate = new Date('2026-10-15T00:00:00.000Z');
    const targetDate = new Date(startDate.getTime() + safeIndex * 3600 * 1000);
    const iso = targetDate.toISOString();
    setMissionDateState(iso.slice(0, 10));
    setMissionTimeState(iso.slice(11, 16));
  }, []);

  const selectSiteById = useCallback((siteId: string) => {
    const found = LUNAR_DEMONSTRATION_SITES.find((s) => s.id === siteId);
    if (found) {
      setSelectedSite(found);
      setIsCustomSite(false);
      setCustomCoordinates(null);
    }
  }, []);

  const setMissionDate = useCallback((date: string) => {
    setMissionDateState(date);
    // Attempt syncing step index
    try {
      const dt = new Date(`${date}T${missionTime}:00Z`);
      const start = new Date('2026-10-15T00:00:00Z');
      const diffHours = Math.round((dt.getTime() - start.getTime()) / (3600 * 1000));
      if (diffHours >= 0 && diffHours < 336) {
        setCurrentTimelineStepState(diffHours);
      }
    } catch {
      // Ignore
    }
  }, [missionTime]);

  const setMissionTime = useCallback((time: string) => {
    setMissionTimeState(time);
    // Attempt syncing step index
    try {
      const dt = new Date(`${missionDate}T${time}:00Z`);
      const start = new Date('2026-10-15T00:00:00Z');
      const diffHours = Math.round((dt.getTime() - start.getTime()) / (3600 * 1000));
      if (diffHours >= 0 && diffHours < 336) {
        setCurrentTimelineStepState(diffHours);
      }
    } catch {
      // Ignore
    }
  }, [missionDate]);

  const setCustomSiteCoordinates = useCallback(
    (latitude: number, longitude: number): boolean => {
      if (
        isNaN(latitude) ||
        isNaN(longitude) ||
        latitude < -90.0 ||
        latitude > -80.0 ||
        longitude < 0.0 ||
        longitude > 360.0
      ) {
        return false;
      }

      const customSite: LunarSite = {
        id: `custom-${latitude.toFixed(2)}-${longitude.toFixed(2)}`,
        name: `Custom Target (${Math.abs(latitude).toFixed(2)}°S, ${longitude.toFixed(2)}°E)`,
        latitude,
        longitude,
        description:
          'User-defined approximate demonstration coordinates for South Pole surface evaluation.',
        isVerified: false,
        coordinateSource: 'Approximate demonstration coordinates',
      };

      setSelectedSite(customSite);
      setIsCustomSite(true);
      setCustomCoordinates({ latitude, longitude });
      return true;
    },
    []
  );

  const resetToPreset = useCallback((siteId?: string) => {
    const target = siteId
      ? LUNAR_DEMONSTRATION_SITES.find((s) => s.id === siteId) || DEFAULT_LUNAR_SITE
      : DEFAULT_LUNAR_SITE;
    setSelectedSite(target);
    setIsCustomSite(false);
    setCustomCoordinates(null);
    setCurrentTimelineStepState(12);
  }, []);

  const value = useMemo<MissionContextValue>(
    () => ({
      selectedSite,
      allSites: LUNAR_DEMONSTRATION_SITES,
      missionDate,
      missionTime,
      selectedTimestampUtc,
      isCustomSite,
      customCoordinates,
      validation,
      currentTimelineStep,
      currentTimelinePoint,
      timelineSeries,
      currentSunPosition,
      currentEarthPosition,
      selectSiteById,
      setMissionDate,
      setMissionTime,
      setCurrentTimelineStep,
      setCustomSiteCoordinates,
      resetToPreset,
    }),
    [
      selectedSite,
      missionDate,
      missionTime,
      selectedTimestampUtc,
      isCustomSite,
      customCoordinates,
      validation,
      currentTimelineStep,
      currentTimelinePoint,
      timelineSeries,
      currentSunPosition,
      currentEarthPosition,
      selectSiteById,
      setMissionDate,
      setMissionTime,
      setCurrentTimelineStep,
      setCustomSiteCoordinates,
      resetToPreset,
    ]
  );

  return (
    <MissionContext.Provider value={value}>{children}</MissionContext.Provider>
  );
};

export const useMission = (): MissionContextValue => {
  const context = useContext(MissionContext);
  if (!context) {
    throw new Error('useMission must be used within a MissionProvider');
  }
  return context;
};
