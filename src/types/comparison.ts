import type { LunarSite } from './mission';

export interface ScenarioMetrics {
  /** Solar elevation at landing epoch (in degrees, null if unavailable) */
  solarElevation: number | null;
  /** Cumulative surface illumination duration over 14-day mission (in hours) */
  sunlightDurationHours: number | null;
  /** Cumulative surface illumination percentage */
  sunlightPercentage: number | null;
  /** Earth elevation at landing epoch (in degrees, null if unavailable) */
  earthElevation: number | null;
  /** Cumulative Direct-To-Earth line-of-sight communication duration (in hours) */
  commVisibilityDurationHours: number | null;
  /** Cumulative Direct-To-Earth communication percentage */
  commPercentage: number | null;
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
}

export type ComparisonMetricKey =
  | 'solarElevation'
  | 'sunlightDurationHours'
  | 'earthElevation'
  | 'commVisibilityDurationHours';

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
