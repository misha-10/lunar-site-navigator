import type { TimelineDataPoint, SiteTimelineSeries, TimelineSummaryMetrics } from '../types/mission';
import { DEMONSTRATION_CELESTIAL_DATA } from './demonstrationCelestial';

/**
 * Procedurally generates a deterministic, physically representative 14-day (336-hour)
 * polar ephemeris and terrain visibility time-series for a given landing site.
 * 
 * Labeled explicitly with isDemoData: true.
 */
export function generateSiteTimelineSeries(
  siteId: string,
  startIso: string = '2026-10-15T00:00:00.000Z'
): SiteTimelineSeries {
  const baseData =
    DEMONSTRATION_CELESTIAL_DATA[siteId] ||
    DEMONSTRATION_CELESTIAL_DATA['shackleton-crater'];

  const startDate = new Date(startIso);
  const totalHours = 336; // 14 Earth days
  const points: TimelineDataPoint[] = [];

  // Orbital physics parameters for lunar South Pole:
  // - Lunar synodic month ~ 708.7 hours (Sun rotates ~0.508°/hr in azimuth)
  // - Lunar libration cycle ~ 655.7 hours (Earth oscillates in elevation and azimuth)
  const synodicRateDegPerHour = 360 / 708.73;
  const librationCycleHours = 655.7;

  // Site-specific baseline adjustments
  const isMalapert = siteId === 'malapert-massif';
  const isConnectingRidge = siteId === 'connecting-ridge';
  const isNobile = siteId === 'nobile-crater';

  const baseSunEl = isMalapert ? 1.6 : isConnectingRidge ? -0.4 : isNobile ? 1.2 : 0.8;
  const sunElSwing = isNobile ? 2.4 : isMalapert ? 1.8 : 1.5;

  const baseEarthEl = isMalapert ? 5.6 : isConnectingRidge ? 2.1 : isNobile ? 0.8 : 3.9;
  const earthElSwing = isNobile ? 2.8 : 1.9;

  let currentDarknessRun = 0;
  let maxDarknessRun = 0;
  let sunlitCount = 0;
  let commCount = 0;

  let minSun = 999;
  let maxSun = -999;
  let minEarth = 999;
  let maxEarth = -999;

  for (let h = 0; h < totalHours; h++) {
    const timeMs = startDate.getTime() + h * 3600 * 1000;
    const dateObj = new Date(timeMs);
    const timestamp = dateObj.toISOString();

    const dayNumber = Math.floor(h / 24) + 1;
    const hourInDay = h % 24;
    const label = `D${dayNumber} ${String(hourInDay).padStart(2, '0')}:00`;

    // 1. Solar Ephemeris
    const sunAzimuth = (baseData.sun.azimuth + h * synodicRateDegPerHour) % 360;
    
    // Polar solar elevation exhibits gentle sinusoidal variation due to subsolar latitude shift
    const sunElAngle = (h / totalHours) * Math.PI;
    const calculatedSunEl = baseSunEl + Math.sin(sunElAngle) * sunElSwing - 0.3;
    const roundedSunEl = Math.round(calculatedSunEl * 100) / 100;

    // Look up local terrain crest obstruction elevation at current Sun azimuth
    const azIndex = Math.floor(sunAzimuth) % 360;
    const terrainElSun = baseData.terrainProfile[azIndex] ?? 1.5;

    const isSunGeometricVisible = roundedSunEl > 0;
    const isSunlit = roundedSunEl > terrainElSun;

    if (isSunlit) {
      sunlitCount++;
      currentDarknessRun = 0;
    } else {
      currentDarknessRun++;
      if (currentDarknessRun > maxDarknessRun) {
        maxDarknessRun = currentDarknessRun;
      }
    }

    if (roundedSunEl < minSun) minSun = roundedSunEl;
    if (roundedSunEl > maxSun) maxSun = roundedSunEl;

    // 2. Earth Ephemeris (Tidally locked with libration oscillation)
    const librationPhase = ((h % librationCycleHours) / librationCycleHours) * 2 * Math.PI;
    const earthAzimuth = (baseData.earth.azimuth + Math.sin(librationPhase) * 3.8 + 360) % 360;
    const calculatedEarthEl = baseEarthEl + Math.cos(librationPhase) * earthElSwing;
    const roundedEarthEl = Math.round(calculatedEarthEl * 100) / 100;

    // Look up terrain crest obstruction elevation at current Earth azimuth
    const earthAzIndex = Math.floor(earthAzimuth) % 360;
    const terrainElEarth = baseData.terrainProfile[earthAzIndex] ?? 1.0;

    const isEarthGeometricVisible = roundedEarthEl > 0;
    const hasEarthComm = roundedEarthEl > terrainElEarth;

    if (hasEarthComm) {
      commCount++;
    }

    if (roundedEarthEl < minEarth) minEarth = roundedEarthEl;
    if (roundedEarthEl > maxEarth) maxEarth = roundedEarthEl;

    points.push({
      stepIndex: h,
      timestamp,
      label,
      missionHour: h,
      sunAzimuth: Math.round(sunAzimuth * 10) / 10,
      sunElevation: roundedSunEl,
      terrainElevationAtSunAz: terrainElSun,
      isSunGeometricVisible,
      isSunlit,
      earthAzimuth: Math.round(earthAzimuth * 10) / 10,
      earthElevation: roundedEarthEl,
      terrainElevationAtEarthAz: terrainElEarth,
      isEarthGeometricVisible,
      hasEarthComm,
      isDemoData: true,
    });
  }

  const summary: TimelineSummaryMetrics = {
    totalSunlightHours: sunlitCount,
    sunlightPercentage: Math.round((sunlitCount / totalHours) * 1000) / 10,
    longestContinuousDarknessHours: maxDarknessRun,
    totalCommHours: commCount,
    commPercentage: Math.round((commCount / totalHours) * 1000) / 10,
    maxSolarElevation: maxSun,
    minSolarElevation: minSun,
    maxEarthElevation: maxEarth,
    minEarthElevation: minEarth,
  };

  return {
    siteId,
    missionStartUtc: startIso,
    totalHours,
    points,
    summary,
    isDemoData: true,
  };
}

/**
 * Pre-computed timeline ephemeris for all demonstration landing sites.
 */
export const DEMONSTRATION_TIMELINE_SERIES: Record<string, SiteTimelineSeries> = {
  'shackleton-crater': generateSiteTimelineSeries('shackleton-crater'),
  'malapert-massif': generateSiteTimelineSeries('malapert-massif'),
  'connecting-ridge': generateSiteTimelineSeries('connecting-ridge'),
  'nobile-crater': generateSiteTimelineSeries('nobile-crater'),
};
