/**
 * LunaScope - Mission Selection & Planning Types
 */

export interface LunarSite {
  id: string;
  name: string;
  /** Latitude in decimal degrees (-90.0° to -80.0° for lunar south polar region) */
  latitude: number;
  /** Longitude in decimal degrees (0.0° to 360.0° East) */
  longitude: number;
  description: string;
  /** Verification status of the coordinates */
  isVerified: boolean;
  /** Source or documentation of coordinates */
  coordinateSource: string;
  /** Optional elevation datum in meters relative to lunar reference radius (1737.4 km) */
  elevation_m?: number;
}

export interface MissionValidationState {
  isValid: boolean;
  errors: {
    latitude?: string;
    longitude?: string;
    date?: string;
    time?: string;
  };
  warnings: string[];
}

/**
 * Celestial position of an astronomical body (Sun or Earth)
 * relative to the local topocentric horizon coordinate system.
 */
export interface CelestialPosition {
  /** Azimuth angle in degrees: 0° (North), 90° (East), 180° (South), 270° (West) */
  azimuth: number;
  /** Elevation angle in degrees relative to the local geometric horizontal tangent plane (0° = Horizon) */
  elevation: number;
  /** Optional local terrain obstruction elevation at this azimuth (in degrees) */
  terrainElevationAtAzimuth?: number;
  /** Explicit indicator that coordinates are demonstration/placeholder values */
  isDemoData?: boolean;
}

export type GeometricVisibility = 'above_horizon' | 'below_horizon';

export type TerrainVisibility = 'visible' | 'occulted' | 'below_horizon';

/**
 * Single temporal epoch step in the 14-day (336-hour) mission evaluation window.
 */
export interface TimelineDataPoint {
  /** Step index (0 to 335) */
  stepIndex: number;
  /** ISO 8601 UTC timestamp string */
  timestamp: string;
  /** Human-readable short chart label (e.g. "D1 00:00", "D7 12:00") */
  label: string;
  /** Relative mission hour from start (0 to 335) */
  missionHour: number;

  // Solar Ephemeris
  /** Solar azimuth in degrees (0° to 360°) */
  sunAzimuth: number;
  /** Solar elevation in degrees relative to 0° geometric horizon (null if missing/telemetry lost) */
  sunElevation: number | null;
  /** Topographic horizon crest blocking angle at sun azimuth in degrees */
  terrainElevationAtSunAz: number;
  /** True if sunElevation > 0° */
  isSunGeometricVisible: boolean;
  /** True if sunElevation > terrainElevationAtSunAz (direct sunlight) */
  isSunlit: boolean;

  // Earth Ephemeris
  /** Earth azimuth in degrees (0° to 360°) */
  earthAzimuth: number;
  /** Earth elevation in degrees relative to 0° geometric horizon (null if missing/telemetry lost) */
  earthElevation: number | null;
  /** Topographic horizon crest blocking angle at earth azimuth in degrees */
  terrainElevationAtEarthAz: number;
  /** True if earthElevation > 0° */
  isEarthGeometricVisible: boolean;
  /** True if earthElevation > terrainElevationAtEarthAz (Direct-To-Earth line-of-sight active) */
  hasEarthComm: boolean;

  /** Flag indicating demonstration dataset */
  isDemoData?: boolean;
}

/**
 * Aggregated summary metrics calculated strictly across the full time series.
 * (Ensures duration is NOT inferred from a single point).
 */
export interface TimelineSummaryMetrics {
  totalSunlightHours: number;
  sunlightPercentage: number;
  longestContinuousDarknessHours: number;
  totalCommHours: number;
  commPercentage: number;
  maxSolarElevation: number;
  minSolarElevation: number;
  maxEarthElevation: number;
  minEarthElevation: number;
}

/**
 * Full time series evaluation dataset for a landing site.
 */
export interface SiteTimelineSeries {
  siteId: string;
  missionStartUtc: string;
  totalHours: number;
  points: TimelineDataPoint[];
  summary: TimelineSummaryMetrics;
  isDemoData: boolean;
}

export interface MissionContextValue {
  selectedSite: LunarSite;
  allSites: LunarSite[];
  missionDate: string; // YYYY-MM-DD
  missionTime: string; // HH:mm
  selectedTimestampUtc: string; // Full ISO 8601 UTC string
  isCustomSite: boolean;
  customCoordinates: { latitude: number; longitude: number } | null;
  validation: MissionValidationState;

  // Timeline & Dynamic Ephemeris State
  currentTimelineStep: number;
  currentTimelinePoint: TimelineDataPoint;
  timelineSeries: SiteTimelineSeries;
  currentSunPosition: CelestialPosition;
  currentEarthPosition: CelestialPosition;
  
  // Actions
  selectSiteById: (siteId: string) => void;
  setMissionDate: (date: string) => void;
  setMissionTime: (time: string) => void;
  setCurrentTimelineStep: (stepIndex: number) => void;
  setCustomSiteCoordinates: (latitude: number, longitude: number) => boolean;
  resetToPreset: (siteId?: string) => void;
}
