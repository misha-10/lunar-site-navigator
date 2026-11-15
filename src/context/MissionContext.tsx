import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import type {
  LunarSite,
  MissionContextValue,
  MissionValidationState,
  CelestialPosition,
  TimelineDataPoint,
  SiteTimelineSeries,
} from '../types/mission';
import type {
  MissionCalculateRequest,
  MissionTimelineRequest,
} from '../types/api';
import {
  LUNAR_DEMONSTRATION_SITES,
  DEFAULT_LUNAR_SITE,
  SITE_ID_ALIAS_MAP,
  findSiteById,
} from '../data/lunarSites';
import {
  DEMONSTRATION_TIMELINE_SERIES,
  generateSiteTimelineSeries,
} from '../data/demonstrationTimeline';
import { missionApi } from '../services/missionApi';

const MissionContext = createContext<MissionContextValue | undefined>(undefined);

/**
 * Helper: Safely converts a timeline data point into a CelestialPosition.
 * Preserves unavailable states (NaN for visualization, null for degrees, never 0.0).
 * Accurately marks demo vs live data mode.
 */
function createPositionFromTimelinePoint(
  azimuthVal: number,
  elevationVal: number | null,
  terrainElevationAtAz: number | undefined,
  isGeometricVisible: boolean,
  isTerrainVisible: boolean,
  isDemo: boolean,
  statusStr?: string
): CelestialPosition {
  const isAvailable = elevationVal !== null && !isNaN(elevationVal);
  return {
    azimuth: isAvailable ? azimuthVal : Number.NaN,
    elevation: isAvailable ? elevationVal : Number.NaN,
    terrainElevationAtAzimuth: terrainElevationAtAz,
    azimuth_deg: isAvailable ? azimuthVal : null,
    elevation_deg: elevationVal,
    geometric_above_horizon: isGeometricVisible,
    terrain_visible: isTerrainVisible,
    status: statusStr || (isDemo ? 'demonstration' : isAvailable ? 'calculated' : 'unavailable'),
    data_mode: isDemo ? 'demonstration_fallback' : 'real_ephemeris',
    isDemoData: isDemo,
  };
}

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
  // Candidate sites catalogue state (initialized with offline presets, refreshed from backend)
  const [allSites, setAllSites] = useState<LunarSite[]>(LUNAR_DEMONSTRATION_SITES);

  // Selected site state
  const [selectedSite, setSelectedSite] = useState<LunarSite>(() => {
    const normalizedId = SITE_ID_ALIAS_MAP[initialSite.id] || initialSite.id;
    return findSiteById(normalizedId) || initialSite;
  });

  const [currentTimelineStep, setCurrentTimelineStepState] = useState<number>(initialStepIndex);
  const [missionDate, setMissionDateState] = useState<string>(initialDate);
  const [missionTime, setMissionTimeState] = useState<string>(initialTime);
  const [isCustomSite, setIsCustomSite] = useState<boolean>(false);
  const [customCoordinates, setCustomCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Timeline Series state (initialized with demonstration fallback, updated via backend timeline)
  const [timelineSeries, setTimelineSeries] = useState<SiteTimelineSeries>(() => {
    const normalizedId = SITE_ID_ALIAS_MAP[selectedSite.id] || selectedSite.id;
    return (
      DEMONSTRATION_TIMELINE_SERIES[normalizedId] ||
      DEMONSTRATION_TIMELINE_SERIES[selectedSite.id] ||
      generateSiteTimelineSeries(selectedSite.id)
    );
  });

  // Current timeline step point
  const currentTimelinePoint = useMemo<TimelineDataPoint>(() => {
    const maxIdx = Math.max(0, timelineSeries.points.length - 1);
    const clampedIndex = Math.max(0, Math.min(currentTimelineStep, maxIdx));
    return timelineSeries.points[clampedIndex] || timelineSeries.points[0];
  }, [currentTimelineStep, timelineSeries]);

  const currentTimelinePointRef = useRef<TimelineDataPoint>(currentTimelinePoint);
  currentTimelinePointRef.current = currentTimelinePoint;

  // Live dynamic celestial positions (Sun & Earth)
  const [currentSunPosition, setCurrentSunPosition] = useState<CelestialPosition>(() => {
    const isAvail = currentTimelinePoint?.sunElevation !== null && currentTimelinePoint?.sunElevation !== undefined;
    return createPositionFromTimelinePoint(
      currentTimelinePoint?.sunAzimuth ?? 90,
      isAvail ? currentTimelinePoint!.sunElevation : null,
      currentTimelinePoint?.terrainElevationAtSunAz,
      currentTimelinePoint?.isSunGeometricVisible ?? false,
      currentTimelinePoint?.isSunlit ?? false,
      currentTimelinePoint?.isDemoData ?? true,
      currentTimelinePoint?.status
    );
  });

  const [currentEarthPosition, setCurrentEarthPosition] = useState<CelestialPosition>(() => {
    const isAvail = currentTimelinePoint?.earthElevation !== null && currentTimelinePoint?.earthElevation !== undefined;
    return createPositionFromTimelinePoint(
      currentTimelinePoint?.earthAzimuth ?? 350,
      isAvail ? currentTimelinePoint!.earthElevation : null,
      currentTimelinePoint?.terrainElevationAtEarthAz,
      currentTimelinePoint?.isEarthGeometricVisible ?? false,
      currentTimelinePoint?.hasEarthComm ?? false,
      currentTimelinePoint?.isDemoData ?? true,
      currentTimelinePoint?.status
    );
  });

  // Request sequencing refs to prevent stale API responses from overwriting newer selections
  const latestCalculateRequestIdRef = useRef<number>(0);
  const lastCalcKeyRef = useRef<string>('');
  const inFlightCalcKeyRef = useRef<string>('');
  const latestTimelineRequestIdRef = useRef<number>(0);
  const lastTimelineKeyRef = useRef<string>('');
  const inFlightTimelineKeyRef = useRef<string>('');

  // 1. Initial Loading: Fetch verified lunar sites from backend catalogue on mount
  useEffect(() => {
    let isMounted = true;
    missionApi
      .getSites()
      .then((sites) => {
        if (!isMounted) return;
        if (sites && Array.isArray(sites) && sites.length > 0) {
          setAllSites(sites);
          // If currently selected site is a preset, synchronize with fetched backend metadata
          setSelectedSite((prev) => {
            if (prev.id.startsWith('custom-')) return prev;
            const normalizedId = SITE_ID_ALIAS_MAP[prev.id] || prev.id;
            const matched = sites.find((s) => s.id === normalizedId || s.id === prev.id);
            return matched || prev;
          });
        }
      })
      .catch((err) => {
        console.warn('[MissionContext] Failed to load sites from backend, keeping presets:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Timeline Series Loading: Retrieve live 7-day ephemeris time-series from backend
  useEffect(() => {
    let isMounted = true;
    const requestId = ++latestTimelineRequestIdRef.current;

    const normalizedSiteId = SITE_ID_ALIAS_MAP[selectedSite.id] || selectedSite.id;
    const reqKey = `${normalizedSiteId}_${
      isCustomSite && customCoordinates ? `${customCoordinates.latitude}_${customCoordinates.longitude}` : ''
    }_${missionDate}`;

    if (reqKey === lastTimelineKeyRef.current || reqKey === inFlightTimelineKeyRef.current) {
      return;
    }
    inFlightTimelineKeyRef.current = reqKey;

    const startDate = new Date(`${missionDate}T00:00:00.000Z`);
    const endDate = new Date(startDate.getTime() + 168 * 3600 * 1000); // 7 days (168 hours)

    const req: MissionTimelineRequest = {
      start_datetime_utc: startDate.toISOString(),
      end_datetime_utc: endDate.toISOString(),
      duration_hours: 168, // Backend strictly enforces a 7-day maximum (168 hours)
      step_minutes: 60,
    };

    if (isCustomSite && customCoordinates) {
      req.latitude_deg = customCoordinates.latitude;
      req.longitude_deg = customCoordinates.longitude;
    } else {
      req.site_id = normalizedSiteId;
    }

    missionApi
      .getTimelineSeries(req)
      .then((series) => {
        if (!isMounted || requestId !== latestTimelineRequestIdRef.current) return;
        if (inFlightTimelineKeyRef.current === reqKey) {
          inFlightTimelineKeyRef.current = '';
        }
        if (series && series.points && series.points.length > 0) {
          if (!series.isDemoData && series.data_mode === 'real_ephemeris') {
            lastTimelineKeyRef.current = reqKey;
          } else {
            lastTimelineKeyRef.current = '';
          }
          setTimelineSeries(series);
        }
      })
      .catch((err) => {
        if (!isMounted || requestId !== latestTimelineRequestIdRef.current) return;
        if (inFlightTimelineKeyRef.current === reqKey) {
          inFlightTimelineKeyRef.current = '';
        }
        lastTimelineKeyRef.current = '';
        console.warn('[MissionContext] Failed to fetch timeline series from backend; retaining fallback:', err);
        const fallback =
          DEMONSTRATION_TIMELINE_SERIES[normalizedSiteId] ||
          DEMONSTRATION_TIMELINE_SERIES[selectedSite.id] ||
          generateSiteTimelineSeries(selectedSite.id);
        setTimelineSeries(fallback);
      });

    return () => {
      isMounted = false;
      if (inFlightTimelineKeyRef.current === reqKey) {
        inFlightTimelineKeyRef.current = '';
      }
    };
  }, [selectedSite.id, isCustomSite, customCoordinates, missionDate]);

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

  // Computed ISO 8601 UTC Timestamp (always ends with explicit 'Z')
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

  // 3. Live Celestial Calculations: Trigger calculateInstantaneous() whenever site or timestamp changes
  useEffect(() => {
    let isMounted = true;
    const requestId = ++latestCalculateRequestIdRef.current;

    const req: MissionCalculateRequest = {
      datetime_utc: selectedTimestampUtc,
    };

    if (isCustomSite && customCoordinates) {
      req.latitude_deg = customCoordinates.latitude;
      req.longitude_deg = customCoordinates.longitude;
    } else if (selectedSite.id && !selectedSite.id.startsWith('custom-')) {
      req.site_id = SITE_ID_ALIAS_MAP[selectedSite.id] || selectedSite.id;
    } else {
      req.latitude_deg = selectedSite.latitude_deg ?? selectedSite.latitude;
      req.longitude_deg = selectedSite.longitude_deg ?? selectedSite.longitude;
    }

    const currentKey = `${req.site_id || ''}_${req.latitude_deg ?? ''}_${req.longitude_deg ?? ''}_${req.datetime_utc}`;
    if (currentKey === lastCalcKeyRef.current || currentKey === inFlightCalcKeyRef.current) {
      return;
    }
    inFlightCalcKeyRef.current = currentKey;

    missionApi
      .calculateInstantaneous(req)
      .then((res) => {
        if (!isMounted || requestId !== latestCalculateRequestIdRef.current) return;
        if (inFlightCalcKeyRef.current === currentKey) {
          inFlightCalcKeyRef.current = '';
        }

        if (res && res.sun && res.earth) {
          if (res.isLive && res.metadata?.data_mode === 'real_ephemeris') {
            // Live SPICE calculation successfully processed
            lastCalcKeyRef.current = currentKey;
            setCurrentSunPosition(res.sun);
            setCurrentEarthPosition(res.earth);
          } else if (!res.error) {
            // Offline demo calculation successfully processed
            lastCalcKeyRef.current = currentKey;
            setCurrentSunPosition((prev) => {
              if (prev.data_mode === 'real_ephemeris' && !prev.isDemoData) {
                return prev; // Never overwrite live SPICE with demo data
              }
              return res.sun;
            });
            setCurrentEarthPosition((prev) => {
              if (prev.data_mode === 'real_ephemeris' && !prev.isDemoData) {
                return prev; // Never overwrite live SPICE with demo data
              }
              return res.earth;
            });
          } else {
            // Transient fallback (e.g. backend unreachable error returned by missionApi)
            // DO NOT mark lastCalcKeyRef.current so retries are allowed!
            lastCalcKeyRef.current = '';
            setCurrentSunPosition((prev) => {
              if (prev.data_mode === 'real_ephemeris' && !prev.isDemoData) {
                return prev; // Never overwrite live SPICE with demo fallback
              }
              return res.sun;
            });
            setCurrentEarthPosition((prev) => {
              if (prev.data_mode === 'real_ephemeris' && !prev.isDemoData) {
                return prev; // Never overwrite live SPICE with demo fallback
              }
              return res.earth;
            });
          }
        }
      })
      .catch((err) => {
        if (!isMounted || requestId !== latestCalculateRequestIdRef.current) return;
        if (inFlightCalcKeyRef.current === currentKey) {
          inFlightCalcKeyRef.current = '';
        }
        lastCalcKeyRef.current = ''; // Allow retries after transient failure!
        console.warn('[MissionContext] calculateInstantaneous failed; preserving state:', err);

        // Do NOT overwrite successfully calculated live SPICE positions on error
        setCurrentSunPosition((prev) => {
          if (prev.data_mode === 'real_ephemeris' && !prev.isDemoData) {
            return prev;
          }
          const point = currentTimelinePointRef.current;
          if (!point) return prev;
          return createPositionFromTimelinePoint(
            point.sunAzimuth,
            point.sunElevation,
            point.terrainElevationAtSunAz,
            point.isSunGeometricVisible,
            point.isSunlit,
            true,
            'demonstration_fallback'
          );
        });

        setCurrentEarthPosition((prev) => {
          if (prev.data_mode === 'real_ephemeris' && !prev.isDemoData) {
            return prev;
          }
          const point = currentTimelinePointRef.current;
          if (!point) return prev;
          return createPositionFromTimelinePoint(
            point.earthAzimuth,
            point.earthElevation,
            point.terrainElevationAtEarthAz,
            point.isEarthGeometricVisible,
            point.hasEarthComm,
            true,
            'demonstration_fallback'
          );
        });
      });

    return () => {
      isMounted = false;
      if (inFlightCalcKeyRef.current === currentKey) {
        inFlightCalcKeyRef.current = '';
      }
    };
  }, [
    selectedSite.id,
    selectedSite.latitude,
    selectedSite.longitude,
    selectedSite.latitude_deg,
    selectedSite.longitude_deg,
    isCustomSite,
    customCoordinates,
    selectedTimestampUtc,
  ]);

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

    // Validate Longitude: Supports IAU East-positive [-180°, 180°] as well as [0°, 360°]
    if (selectedSite.longitude < -180.0 || selectedSite.longitude > 360.0) {
      errors.longitude = 'Longitude must be between -180.00° and +180.00° (or 0° to 360°)';
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
  const setCurrentTimelineStep = useCallback(
    (stepIndex: number) => {
      const maxSteps = Math.max(0, timelineSeries.points.length - 1);
      const safeIndex = Math.max(0, Math.min(stepIndex, maxSteps));
      setCurrentTimelineStepState(safeIndex);

      // Immediately synchronize celestial position preview from the active timeline point
      const activePoint = timelineSeries.points[safeIndex];
      if (activePoint) {
        const isLiveTimeline =
          !timelineSeries.isDemoData &&
          timelineSeries.data_mode === 'real_ephemeris' &&
          !activePoint.isDemoData;

        if (isLiveTimeline) {
          // Genuine live timeline sample: update displayed positions immediately
          setCurrentSunPosition(
            createPositionFromTimelinePoint(
              activePoint.sunAzimuth,
              activePoint.sunElevation,
              activePoint.terrainElevationAtSunAz,
              activePoint.isSunGeometricVisible,
              activePoint.isSunlit,
              false,
              activePoint.status
            )
          );

          setCurrentEarthPosition(
            createPositionFromTimelinePoint(
              activePoint.earthAzimuth,
              activePoint.earthElevation,
              activePoint.terrainElevationAtEarthAz,
              activePoint.isEarthGeometricVisible,
              activePoint.hasEarthComm,
              false,
              activePoint.status
            )
          );
        } else {
          // Demo timeline sample: only update if currently in demo mode.
          // PREVENT demo timeline samples from overwriting successfully calculated live SPICE positions!
          setCurrentSunPosition((prev) => {
            if (prev.data_mode === 'real_ephemeris' && !prev.isDemoData) {
              return prev; // Preserve live SPICE calculation!
            }
            return createPositionFromTimelinePoint(
              activePoint.sunAzimuth,
              activePoint.sunElevation,
              activePoint.terrainElevationAtSunAz,
              activePoint.isSunGeometricVisible,
              activePoint.isSunlit,
              true,
              activePoint.status
            );
          });

          setCurrentEarthPosition((prev) => {
            if (prev.data_mode === 'real_ephemeris' && !prev.isDemoData) {
              return prev; // Preserve live SPICE calculation!
            }
            return createPositionFromTimelinePoint(
              activePoint.earthAzimuth,
              activePoint.earthElevation,
              activePoint.terrainElevationAtEarthAz,
              activePoint.isEarthGeometricVisible,
              activePoint.hasEarthComm,
              true,
              activePoint.status
            );
          });
        }

        if (activePoint.timestamp) {
          try {
            const dt = new Date(activePoint.timestamp);
            if (!isNaN(dt.getTime())) {
              const iso = dt.toISOString();
              setMissionDateState(iso.slice(0, 10));
              setMissionTimeState(iso.slice(11, 16));
              return;
            }
          } catch {
            // Fall through
          }
        }
      }

      const startDate = new Date(timelineSeries.missionStartUtc || '2026-10-15T00:00:00.000Z');
      const targetDate = new Date(startDate.getTime() + safeIndex * 3600 * 1000);
      const iso = targetDate.toISOString();
      setMissionDateState(iso.slice(0, 10));
      setMissionTimeState(iso.slice(11, 16));
    },
    [timelineSeries]
  );

  const selectSiteById = useCallback(
    (siteId: string) => {
      const normalizedId = SITE_ID_ALIAS_MAP[siteId] || siteId;
      const found =
        allSites.find((s) => s.id === normalizedId || s.id === siteId) ||
        findSiteById(siteId) ||
        LUNAR_DEMONSTRATION_SITES.find((s) => s.id === normalizedId || s.id === siteId);

      if (found) {
        setSelectedSite(found);
        setIsCustomSite(false);
        setCustomCoordinates(null);
      }
    },
    [allSites]
  );

  const setMissionDate = useCallback(
    (date: string) => {
      setMissionDateState(date);
      // Synchronize step index relative to timeline start
      try {
        const dt = new Date(`${date}T${missionTime}:00Z`);
        const start = new Date(timelineSeries.missionStartUtc || '2026-10-15T00:00:00Z');
        const diffHours = Math.round((dt.getTime() - start.getTime()) / (3600 * 1000));
        const maxSteps = Math.max(0, timelineSeries.points.length - 1);
        if (diffHours >= 0 && diffHours <= maxSteps) {
          setCurrentTimelineStepState(diffHours);
        }
      } catch {
        // Ignore
      }
    },
    [missionTime, timelineSeries.missionStartUtc, timelineSeries.points.length]
  );

  const setMissionTime = useCallback(
    (time: string) => {
      setMissionTimeState(time);
      // Synchronize step index relative to timeline start
      try {
        const dt = new Date(`${missionDate}T${time}:00Z`);
        const start = new Date(timelineSeries.missionStartUtc || '2026-10-15T00:00:00Z');
        const diffHours = Math.round((dt.getTime() - start.getTime()) / (3600 * 1000));
        const maxSteps = Math.max(0, timelineSeries.points.length - 1);
        if (diffHours >= 0 && diffHours <= maxSteps) {
          setCurrentTimelineStepState(diffHours);
        }
      } catch {
        // Ignore
      }
    },
    [missionDate, timelineSeries.missionStartUtc, timelineSeries.points.length]
  );

  const setCustomSiteCoordinates = useCallback(
    (latitude: number, longitude: number): boolean => {
      if (
        isNaN(latitude) ||
        isNaN(longitude) ||
        latitude < -90.0 ||
        latitude > -80.0 ||
        longitude < -180.0 ||
        longitude > 360.0
      ) {
        return false;
      }

      const lonLabel =
        longitude >= 0
          ? `${longitude.toFixed(2)}°E`
          : `${Math.abs(longitude).toFixed(2)}°W`;

      const customSite: LunarSite = {
        id: `custom-${latitude.toFixed(2)}-${longitude.toFixed(2)}`,
        name: `Custom Target (${Math.abs(latitude).toFixed(2)}°S, ${lonLabel})`,
        latitude_deg: latitude,
        longitude_deg: longitude,
        latitude,
        longitude,
        coordinate_status: 'custom_user_specified',
        description: `User-specified coordinates at ${Math.abs(latitude).toFixed(2)}°S, ${lonLabel}.`,
        provenance: 'User Specified Coordinates',
        isVerified: false,
        coordinateSource: 'User Specified Coordinates',
      };

      setSelectedSite(customSite);
      setIsCustomSite(true);
      setCustomCoordinates({ latitude, longitude });
      return true;
    },
    []
  );

  const resetToPreset = useCallback(
    (siteId?: string) => {
      const targetId = siteId ? (SITE_ID_ALIAS_MAP[siteId] || siteId) : DEFAULT_LUNAR_SITE.id;
      const target =
        allSites.find((s) => s.id === targetId) ||
        findSiteById(targetId) ||
        DEFAULT_LUNAR_SITE;

      setSelectedSite(target);
      setIsCustomSite(false);
      setCustomCoordinates(null);
      setCurrentTimelineStepState(12);
    },
    [allSites]
  );

  const value = useMemo<MissionContextValue>(
    () => ({
      selectedSite,
      allSites,
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
      allSites,
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
export default MissionContext;
