/**
 * LunaScope - Mission Selection & Planning Types
 * Fully aligned with backend SPICE ephemeris models and FastAPI Pydantic contracts.
 */

export interface LunarSite {
  id: string;
  name: string;
  /** Exact backend latitude field in decimal degrees [-90.0, 90.0], negative South */
  latitude_deg?: number;
  /** Exact backend longitude field in decimal degrees [-180.0, 180.0], East-positive */
  longitude_deg?: number;
  /** Backend reliability/precision indicator (e.g. 'approximate_region_center', 'illustrative') */
  coordinate_status?: string;
  description: string;
  /** Scientific reference or dataset source for coordinates (matches backend provenance) */
  provenance?: string | null;

  // Frontend convenience and backward-compatibility aliases
  /** Alias for latitude_deg (negative South) */
  latitude: number;
  /** Alias for longitude_deg (East-positive) */
  longitude: number;
  /** Boolean verification indicator derived from coordinate_status */
  isVerified: boolean;
  /** Alias for provenance */
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

export type EphemerisDataMode = 'real_ephemeris' | 'unavailable' | 'simplified' | string;

/**
 * Celestial position of an astronomical body (Sun or Earth)
 * relative to the local topocentric horizon coordinate system.
 */
export interface CelestialPosition {
  /** Azimuth angle in degrees: 0° (North), 90° (East), 180° (South), 270° (West) */
  azimuth: number;
  /** Elevation angle in degrees relative to the geometric horizontal tangent plane (0° = Horizon) */
  elevation: number;
  /** Optional local terrain obstruction elevation at this azimuth (in degrees) */
  terrainElevationAtAzimuth?: number;

  // Exact backend ephemeris fields from CelestialBodyStatus
  /** Local azimuth in degrees from backend ephemeris (null if unavailable) */
  azimuth_deg?: number | null;
  /** Local elevation in degrees from backend ephemeris (null if unavailable) */
  elevation_deg?: number | null;
  /** True if body is geometrically above the 0° tangent horizon plane (null if calculation failed) */
  geometric_above_horizon?: boolean | null;
  /** True if body is above local topographic crest (null when terrain obstruction is not evaluated) */
  terrain_visible?: boolean | null;

  /** Calculation status from backend: 'calculated', 'unavailable', or 'approximate' */
  status?: 'calculated' | 'unavailable' | 'approximate' | string;
  /** Scientific reason if calculation is unavailable */
  reason?: string | null;

  /** Scientific ephemeris provenance mode ('real_ephemeris' or 'unavailable') */
  data_mode?: EphemerisDataMode;

  /** Explicit indicator that coordinates are demonstration/placeholder values */
  isDemoData?: boolean;
}

export type GeometricVisibility = 'above_horizon' | 'below_horizon';

export type TerrainVisibility = 'visible' | 'occulted' | 'below_horizon' | 'unavailable';

/**
 * Single temporal epoch step in the mission evaluation window.
 * Supports explicit null values when ephemeris is missing or unavailable.
 */
export interface TimelineDataPoint {
  /** Step index (0-based) */
  stepIndex: number;
  /** ISO 8601 UTC timestamp string (e.g. '2027-01-15T12:00:00Z') */
  timestamp: string;
  /** Human-readable short chart label (e.g. "D1 00:00", "D7 12:00") */
  label: string;
  /** Relative mission hour from start */
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

  /** Calculation status from backend */
  status?: string;
  /** Flag indicating demonstration dataset */
  isDemoData?: boolean;
}

/**
 * Aggregated summary metrics calculated strictly across the full time series.
 * Preserves the backend's critical distinction:
 * - total_sampled_geometric_visibility_hours (discrete adjacent valid visible sample sum)
 * - interpolated_geometric_visibility_hours (derived window boundary interpolation)
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

  // Exact backend visibility duration metrics from BodySummaryMetrics
  total_sampled_geometric_visibility_hours?: number;
  interpolated_geometric_visibility_hours?: number;
  valid_sample_count?: number;
  meanSolarElevation?: number | null;
  meanEarthElevation?: number | null;
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
  data_mode?: EphemerisDataMode;
  isDemoData: boolean;
}

export interface MissionContextValue {
  selectedSite: LunarSite;
  allSites: LunarSite[];
  missionDate: string; // YYYY-MM-DD
  missionTime: string; // HH:mm
  selectedTimestampUtc: string; // Full ISO 8601 UTC string with 'Z'
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
