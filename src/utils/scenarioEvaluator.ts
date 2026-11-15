import type { LunarSite } from '../types/mission';
import type { ScenarioMetrics, ComparisonScenario, MetricComparisonItem, ComparisonMetricKey } from '../types/comparison';
import { generateSiteTimelineSeries } from '../data/demonstrationTimeline';

/**
 * Deterministically computes scenario evaluation metrics for a given landing site, date, and time.
 * If isSimulatedMissing is true, returns null metrics to test missing-data states.
 */
export function evaluateScenarioMetrics(
  site: LunarSite,
  date: string,
  time: string,
  isSimulatedMissing: boolean = false
): ScenarioMetrics {
  if (isSimulatedMissing) {
    return {
      solarElevation: null,
      sunlightDurationHours: null,
      sunlightPercentage: null,
      earthElevation: null,
      commVisibilityDurationHours: null,
      commPercentage: null,
    };
  }

  // Generate deterministic 7-day ephemeris starting at the selected date
  const isoStart = `${date}T00:00:00.000Z`;
  const series = generateSiteTimelineSeries(site.id, isoStart);

  // Parse hour from time string HH:mm
  let targetHour = 0;
  try {
    const parts = time.split(':');
    targetHour = Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0));
  } catch {
    targetHour = 0;
  }

  const landingPoint = series.points[targetHour] || series.points[0];

  return {
    solarElevation: landingPoint.sunElevation,
    sunlightDurationHours: series.summary.totalSunlightHours,
    sunlightPercentage: series.summary.sunlightPercentage,
    earthElevation: landingPoint.earthElevation,
    commVisibilityDurationHours: series.summary.totalCommHours,
    commPercentage: series.summary.commPercentage,
    totalSampledSunlightHours: series.summary.totalSunlightHours,
    interpolatedSunlightHours: series.summary.totalSunlightHours,
    totalSampledCommHours: series.summary.totalCommHours,
    interpolatedCommHours: series.summary.totalCommHours,
    minSolarElevation: series.summary.minSolarElevation,
    maxSolarElevation: series.summary.maxSolarElevation,
    minEarthElevation: series.summary.minEarthElevation,
    maxEarthElevation: series.summary.maxEarthElevation,
  };
}

/**
 * Compares 2 or 3 scenarios for each of the 4 individual metrics.
 * Identifies which scenario performs better for each individual metric (highest physical value).
 * Strictly avoids arbitrary composite scoring.
 */
export function compareScenarios(scenarios: ComparisonScenario[]): MetricComparisonItem[] {
  const metricConfigs: { key: ComparisonMetricKey; title: string; unit: string; category: 'power' | 'comms'; description: string }[] = [
    {
      key: 'solarElevation',
      title: 'Solar Elevation at Landing',
      unit: '°',
      category: 'power',
      description: 'Higher elevation improves solar array grazing incidence angle and clears local terrain rims.',
    },
    {
      key: 'sunlightDurationHours',
      title: 'Cumulative Sunlight Duration',
      unit: 'h',
      category: 'power',
      description: 'Total continuous and intermittent illumination window across 7 Earth days (168 hours).',
    },
    {
      key: 'earthElevation',
      title: 'Earth Elevation at Landing',
      unit: '°',
      category: 'comms',
      description: 'Higher elevation clears topographic horizons and provides robust Direct-To-Earth RF link margins.',
    },
    {
      key: 'commVisibilityDurationHours',
      title: 'Direct-to-Earth Comm Duration',
      unit: 'h',
      category: 'comms',
      description: 'Total line-of-sight visibility window to Earth stations across 7 Earth days (168 hours).',
    },
  ];

  return metricConfigs.map((config) => {
    let maxVal: number = -Infinity;
    let leadingId: string | null = null;
    let isTie = false;
    let validCount = 0;

    for (const scn of scenarios) {
      const val = scn.metrics[config.key];
      if (val !== null && val !== undefined && typeof val === 'number' && !Number.isNaN(val)) {
        validCount++;
        if (val > maxVal) {
          maxVal = val;
          leadingId = scn.id;
          isTie = false;
        } else if (val === maxVal) {
          isTie = true;
        }
      }
    }

    // If no valid data or all tied, leadingId is null
    if (validCount === 0 || (isTie && scenarios.length > 1)) {
      leadingId = null;
    }

    return {
      ...config,
      leadingScenarioId: leadingId,
      isTie,
    };
  });
}
