import type { LunarSite } from './mission';

/**
 * Backend API Contract for LunaScope Lunar South Pole Mission Planner
 * Based on backend test suite specifications (90 passed tests).
 */

// -------------------------------------------------------------
// 1. GET /sites
// -------------------------------------------------------------
export interface GetSitesResponse {
  sites: LunarSite[];
  total: number;
  data_source: string;
}

// -------------------------------------------------------------
// 2. POST /mission/calculate
// -------------------------------------------------------------
export interface MissionCalculateRequest {
  site_id?: string;
  latitude: number;
  longitude: number;
  timestamp: string; // ISO 8601 UTC
  elevation_m?: number;
}

export interface InstantaneousCelestialState {
  azimuth_deg: number;
  elevation_deg: number;
  terrain_crest_elevation_deg: number;
  is_geometric_visible: boolean; // elevation > 0°
  is_terrain_visible: boolean;   // elevation > terrain_crest
}

export interface MissionCalculateResponse {
  site: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    elevation_m?: number;
    is_verified: boolean;
  };
  timestamp: string;
  sun: InstantaneousCelestialState;
  earth: InstantaneousCelestialState;
  horizon_crest_profile_360?: number[]; // Optional 360-deg azimuth obstruction profile
  data_status: 'live_ephemeris' | 'demonstration_simulation';
}

// -------------------------------------------------------------
// 3. POST /mission/timeline
// -------------------------------------------------------------
export interface MissionTimelineRequest {
  site_id?: string;
  latitude: number;
  longitude: number;
  start_time: string; // ISO 8601 UTC
  duration_hours?: number; // default: 336 (14 Earth days)
  step_size_hours?: number; // default: 1.0
  elevation_m?: number;
}

export interface TimelineSamplePoint {
  step_index: number;
  timestamp: string;
  mission_elapsed_hours: number;
  
  // Solar ephemeris
  sun_azimuth_deg: number;
  sun_elevation_deg: number | null;
  terrain_crest_sun_deg: number;
  is_sun_geometric_visible: boolean;
  is_sunlit: boolean;

  // Earth ephemeris
  earth_azimuth_deg: number;
  earth_elevation_deg: number | null;
  terrain_crest_earth_deg: number;
  is_earth_geometric_visible: boolean;
  has_earth_comm: boolean;

  is_valid_sample: boolean;
}

/**
 * Crucial backend distinction preserved:
 * - total_sampled_geometric_visibility_hours: Discrete observed visibility between adjacent valid samples
 * - interpolated_geometric_visibility_hours: Sub-step visibility using interpolated horizon crossings
 */
export interface TimelineSummaryStatistics {
  total_evaluation_hours: number;
  
  // Solar Illumination Measurements
  total_sampled_sunlight_hours: number;
  interpolated_sunlight_hours: number;
  sunlight_percentage: number;
  longest_continuous_darkness_hours: number;
  min_sun_elevation_deg: number | null;
  max_sun_elevation_deg: number | null;

  // Earth Communication Measurements
  total_sampled_comm_hours: number;
  interpolated_comm_hours: number;
  comm_percentage: number;
  longest_comm_blackout_hours: number;
  min_earth_elevation_deg: number | null;
  max_earth_elevation_deg: number | null;

  // Discrete Sample Pair vs Continuous Interpolated Visibility Distinction
  total_sampled_geometric_visibility_hours: number;
  interpolated_geometric_visibility_hours: number;

  valid_sample_count: number;
  missing_sample_count: number;
}

export interface MissionTimelineResponse {
  site_id: string;
  start_time: string;
  duration_hours: number;
  step_size_hours: number;
  samples: TimelineSamplePoint[];
  summary: TimelineSummaryStatistics;
  data_status: 'live_ephemeris' | 'demonstration_simulation';
}

// -------------------------------------------------------------
// 4. POST /mission/compare
// -------------------------------------------------------------
export interface ScenarioInputPayload {
  scenario_id: string;
  label: string;
  site_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface ScenarioCompareRequest {
  scenarios: ScenarioInputPayload[];
  duration_hours?: number; // default: 336
}

export interface ScenarioEvaluatedMetrics {
  scenario_id: string;
  label: string;
  site_name: string;
  solar_elevation_at_landing: number | null;
  total_sampled_sunlight_hours: number;
  interpolated_sunlight_hours: number;
  sunlight_percentage: number;
  earth_elevation_at_landing: number | null;
  total_sampled_comm_hours: number;
  interpolated_comm_hours: number;
  comm_percentage: number;
  total_sampled_geometric_visibility_hours: number;
  interpolated_geometric_visibility_hours: number;
}

export interface MissionCompareResponse {
  scenarios: ScenarioEvaluatedMetrics[];
  comparison_window_hours: number;
  trade_off_disclaimer: string;
}
