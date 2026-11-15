import type { LunarSite } from './mission';

export interface ScenarioMetrics {
  /** Solar elevation at landing epoch (in degrees, null if unavailable) */
  solarElevation: number | null;
  /** Cumulative surface illumination duration over mission (in hours) */
  sunlightDurationHours: number | null;
  /** Cumulative surface illumination percentage */
  sunlightPercentage: number | null;
  /** Earth elevation at landing epoch (in degrees, null if unavailable) */
  earthElevation: number | null;
  /** Cumulative Direct-To-Earth line-of-sight communication duration (in hours) */
  commVisibilityDurationHours: number | null;
  /** Cumulative Direct-To-Earth communication percentage */
  commPercentage: number | null;

  // Normalized SPICE visibility metrics
  /** Discrete adjacent-sample observed sunlight hours */
  totalSampledSunlightHours?: number | null;
  /** Interpolated horizon-crossing sunlight window hours */
  interpolatedSunlightHours?: number | null;
  /** Discrete adjacent-sample observed Direct-To-Earth hours */
  totalSampledCommHours?: number | null;
  /** Interpolated horizon-crossing Direct-To-Earth window hours */
  interpolatedCommHours?: number | null;
  /** Mean solar elevation over evaluated window */
  meanSolarElevation?: number | null;
  /** Mean Earth elevation over evaluated window */
  meanEarthElevation?: number | null;
  /** Minimum and maximum solar elevations */
  minSolarElevation?: number | null;
  maxSolarElevation?: number | null;
  /** Minimum and maximum Earth elevations */
  minEarthElevation?: number | null;
  maxEarthElevation?: number | null;
}

export interface ComparisonScenario {
  id: string;
  name: string;
  label: string; // "Scenario A", "Scenario B", "Scenario C"
  site: LunarSite;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  metrics: ScenarioMetrics;
  isDemoData: boolean;
  isSimulatedMissing?: boolean;
  dataMode?: 'real_ephemeris' | 'demonstration_simulation' | 'unavailable';
}

export type ComparisonMetricKey =
  | 'solarElevation'
  | 'sunlightDurationHours'
  | 'earthElevation'
  | 'commVisibilityDurationHours'
  | 'totalSampledSunlightHours'
  | 'interpolatedSunlightHours'
  | 'totalSampledCommHours'
  | 'interpolatedCommHours';

export interface MetricComparisonItem {
  key: ComparisonMetricKey;
  title: string;
  unit: string;
  category: 'power' | 'comms';
  description: string;
  /** ID of scenario with the best (highest) performance for this metric, or null if tie/unavailable */
  leadingScenarioId: string | null;
  isTie: boolean;
}
