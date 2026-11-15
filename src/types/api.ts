import type { LunarSite } from './mission';

/**
 * LunaScope API Contracts
 * Exactly normalized to backend FastAPI Pydantic schemas in `backend/app/schemas/`.
 */

// ============================================================================
// 1. Health Endpoint (GET /health)
// ============================================================================

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

// ============================================================================
// 2. Site Catalogue Endpoints (GET /sites)
// ============================================================================

export interface Site extends Partial<LunarSite> {
  id: string;
  name: string;
  latitude_deg: number;
  longitude_deg: number;
  coordinate_status: string;
  description: string;
  provenance: string | null;

  // Frontend compatibility fields mapped for existing consumers
  latitude: number;
  longitude: number;
  isVerified: boolean;
  coordinateSource: string;
  elevation_m?: number;
}

export interface SiteCatalogueMetadata {
  coordinate_convention: string;
  source: string;
  note: string;
}

export interface SiteListResponse {
  sites: Site[];
  metadata: SiteCatalogueMetadata;
  // Backward-compatibility optional fields
  total?: number;
  data_source?: string;
}

// Alias for frontend consumers
export type GetSitesResponse = SiteListResponse;

// ============================================================================
// 3. Single Timestamp Ephemeris (POST /mission/calculate)
// ============================================================================

export interface MissionCalculateRequest {
  site_id?: string | null;
  latitude_deg?: number | null;
  longitude_deg?: number | null;
  /** ISO 8601 UTC timestamp with explicit timezone (e.g. '2027-01-15T12:00:00Z') */
  datetime_utc: string;
  observer_altitude_m?: number | null;

  // Transitional/legacy field compatibility for existing consumers
  latitude?: number;
  longitude?: number;
  timestamp?: string;
  elevation_m?: number;
}

export interface ScenarioResponse {
  site_id: string | null;
  latitude_deg: number;
  longitude_deg: number;
  datetime_utc: string;
}

export interface CelestialBodyStatus {
  azimuth_deg: number | null;
  elevation_deg: number | null;
  geometric_above_horizon: boolean | null;
  /** Topographic terrain visibility (null in current SPICE ephemeris) */
  terrain_visible: boolean | null;
  status: 'calculated' | 'unavailable' | 'approximate' | string;
  reason: string | null;

  // Transitional compatibility
  terrain_crest_elevation_deg?: number;
}

export type EphemerisDataMode = 'real_ephemeris' | 'unavailable' | 'simplified' | string;

export interface MissionMetadata {
  data_mode: EphemerisDataMode;
  sources: string[];
  reference_frame: string | null;
  time_scale: string;
  calculated_at_utc: string;
  limitations: string[];
}

export interface MissionCalculateResponse {
  scenario: ScenarioResponse;
  sun: CelestialBodyStatus;
  earth: CelestialBodyStatus;
  metadata: MissionMetadata;

  // Transitional compatibility fields for missionApi.ts
  site?: any;
  timestamp?: string;
  data_status?: 'live_ephemeris' | 'demonstration_simulation' | string;
}

export interface InstantaneousCelestialState {
  azimuth_deg: number;
  elevation_deg: number;
  terrain_crest_elevation_deg: number;
  is_geometric_visible: boolean;
  is_terrain_visible: boolean;
}

// ============================================================================
// 4. Mission Timeline & Visibility Windows (POST /mission/timeline)
// ============================================================================

export interface TimelineRequest {
  site_id?: string | null;
  latitude_deg?: number | null;
  longitude_deg?: number | null;
  /** Start instant of the evaluation interval in ISO 8601 UTC format */
  start_datetime_utc: string;
  /** End instant of the evaluation interval in ISO 8601 UTC format (max 7 days from start) */
  end_datetime_utc: string;
  /** Sampling interval in minutes (between 15 and 360, default 30) */
  step_minutes?: number;
  observer_altitude_m?: number | null;

  // Transitional compatibility fields
  start_time?: string;
  duration_hours?: number;
  step_size_hours?: number;
}

export type MissionTimelineRequest = TimelineRequest;

export interface TimelineScenarioResponse {
  site_id: string | null;
  latitude_deg: number;
  longitude_deg: number;
  start_datetime_utc: string;
  end_datetime_utc: string;
  step_minutes: number;
}

export interface TimelineSample {
  datetime_utc: string;
  sun: CelestialBodyStatus;
  earth: CelestialBodyStatus;

  // Transitional compatibility fields for legacy missionApi.ts (prior to Phase 2 adapter)
  step_index?: any;
  timestamp?: any;
  mission_elapsed_hours?: any;
  sun_azimuth_deg?: any;
  sun_elevation_deg?: any;
  terrain_crest_sun_deg?: any;
  is_sun_geometric_visible?: any;
  is_sunlit?: any;
  earth_azimuth_deg?: any;
  earth_elevation_deg?: any;
  terrain_crest_earth_deg?: any;
  is_earth_geometric_visible?: any;
  has_earth_comm?: any;
  is_valid_sample?: any;
}

export type BoundaryReason = 'horizon_transition' | 'range_boundary' | 'data_gap';

export interface VisibilityWindow {
  start_datetime_utc: string;
  end_datetime_utc: string;
  duration_hours: number;
  start_boundary_estimated: boolean;
  end_boundary_estimated: boolean;
  start_boundary_reason: BoundaryReason;
  end_boundary_reason: BoundaryReason;
  truncated_at_start: boolean;
  truncated_at_end: boolean;
  visibility_type: 'geometric' | 'terrain' | string;
  status: string;
}

export interface TimelineMetadata {
  data_mode: EphemerisDataMode;
  sources: string[];
  reference_frame: string | null;
  time_scale: string;
  step_minutes: number;
  sample_count: number;
  calculated_at_utc: string;
  terrain_evaluated: boolean;
  limitations: string[];
}

export interface TimelineResponse {
  scenario: TimelineScenarioResponse;
  samples: TimelineSample[];
  sun_visibility_windows: VisibilityWindow[];
  earth_visibility_windows: VisibilityWindow[];
  windows?: {
    sunlight?: VisibilityWindow[];
    earth_geometric_visibility?: VisibilityWindow[];
    earth_terrain_visibility?: VisibilityWindow[];
    [key: string]: VisibilityWindow[] | undefined;
  } | null;
  metadata: TimelineMetadata;

  // Transitional compatibility fields for legacy missionApi.ts
  site_id?: any;
  start_time?: any;
  duration_hours?: any;
  step_size_hours?: any;
  summary?: any;
  data_status?: 'live_ephemeris' | 'demonstration_simulation' | string;
}

export type MissionTimelineResponse = TimelineResponse;
export type TimelineSamplePoint = TimelineSample;

// ============================================================================
// 5. Multi-Site Comparison (POST /mission/compare)
// ============================================================================

export interface ScenarioDefinition {
  scenario_id: string;
  name?: string | null;
  site_id?: string | null;
  latitude_deg?: number | null;
  longitude_deg?: number | null;
  observer_altitude_m?: number | null;

  // Transitional compatibility
  label?: string;
  latitude?: number;
  longitude?: number;
  timestamp?: string;
}

export type ScenarioInputPayload = ScenarioDefinition;

export interface ComparisonRequest {
  scenarios: ScenarioDefinition[];
  start_datetime_utc: string;
  end_datetime_utc: string;
  step_minutes?: number;
  observer_altitude_m?: number | null;

  // Transitional compatibility
  duration_hours?: number;
}

export type ScenarioCompareRequest = ComparisonRequest;

/**
 * Crucial backend distinction preserved:
 * - total_sampled_geometric_visibility_hours: Observed visibility derived by summing adjacent valid visible sample intervals
 * - interpolated_geometric_visibility_hours: Total duration of derived visibility windows using linear horizon crossing interpolation
 */
export interface BodySummaryMetrics {
  min_elevation_deg: number | null;
  max_elevation_deg: number | null;
  mean_elevation_deg: number | null;
  valid_sample_count: number;
  geometrically_visible_sample_count: number;
  total_sampled_geometric_visibility_hours: number;
  interpolated_geometric_visibility_hours: number;
}

export interface ScenarioComparisonResult {
  scenario_id: string;
  name: string | null;
  site_id: string | null;
  latitude_deg: number;
  longitude_deg: number;
  observer_altitude_m: number;
  sun_summary: BodySummaryMetrics;
  earth_summary: BodySummaryMetrics;
  samples: TimelineSample[];
  sun_visibility_windows: VisibilityWindow[];
  earth_visibility_windows: VisibilityWindow[];
  windows?: {
    sunlight?: VisibilityWindow[];
    earth_geometric_visibility?: VisibilityWindow[];
    earth_terrain_visibility?: VisibilityWindow[];
    [key: string]: VisibilityWindow[] | undefined;
  } | null;
  metadata: TimelineMetadata;
}

export interface ComparisonMetadata {
  start_datetime_utc: string;
  end_datetime_utc: string;
  step_minutes: number;
  sample_count: number;
  scenario_count: number;
  all_data_complete: boolean;
  shared_timestamps_utc: string[];
  common_reference_frame: string | null;
  frames_consistent: boolean;
  warnings: string[];
  limitations: string[];
  calculated_at_utc: string;
}

export interface ComparisonResponse {
  results: ScenarioComparisonResult[];
  comparison_metadata: ComparisonMetadata;

  // Transitional compatibility fields
  scenarios?: any[];
  comparison_window_hours?: number;
  trade_off_disclaimer?: string;
}

export type MissionCompareResponse = ComparisonResponse;
