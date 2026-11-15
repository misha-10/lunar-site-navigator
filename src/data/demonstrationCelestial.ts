import type { CelestialPosition } from '../types/mission';

export interface SiteCelestialData {
  siteId: string;
  sun: CelestialPosition;
  earth: CelestialPosition;
  /** Cumulative solar illumination duration across 14-day (336-hour) mission window */
  sunlightDurationHours: number;
  /** Cumulative Direct-To-Earth line-of-sight communication visibility duration */
  commVisibilityDurationHours: number;
  /** 360 values representing terrain horizon crest elevation in degrees (0° to 359° azimuth) */
  terrainProfile: number[];
}

/**
 * Procedurally generates a deterministic 360-degree horizon profile
 * representing topographic ridges and crater rims around the site.
 */
function createHorizonProfile(baseEl: number, peaks: { az: number; el: number; spread: number }[]): number[] {
  const profile: number[] = new Array(360).fill(baseEl);
  for (let az = 0; az < 360; az++) {
    let el = baseEl + Math.sin((az * Math.PI) / 180 * 2) * 0.6;
    for (const p of peaks) {
      const diff = Math.min(Math.abs(az - p.az), 360 - Math.abs(az - p.az));
      if (diff < p.spread) {
        const factor = Math.cos((diff / p.spread) * (Math.PI / 2));
        el += p.el * Math.pow(factor, 2);
      }
    }
    profile[az] = Math.round(Math.max(0, el) * 10) / 10;
  }
  return profile;
}

/**
 * Published demonstration ephemeris snapshots and duration metrics for candidate landing sites
 * based on representative Artemis III polar mission observation windows (14 Earth days = 336 hours).
 * Labeled explicitly with isDemoData: true per scientific requirements.
 */
export const DEMONSTRATION_CELESTIAL_DATA: Record<string, SiteCelestialData> = {
  'shackleton-crater': {
    siteId: 'shackleton-crater',
    sun: {
      azimuth: 142.5,
      elevation: 1.85,
      terrainElevationAtAzimuth: 2.4, // Demonstrates terrain occultation while geometrically above 0°
      isDemoData: true,
    },
    earth: {
      azimuth: 0.8,
      elevation: 3.9,
      terrainElevationAtAzimuth: 1.2, // Demonstrates clear Direct-To-Earth line of sight
      isDemoData: true,
    },
    sunlightDurationHours: 298.0, // 88.7% of 336-hour Artemis window
    commVisibilityDurationHours: 272.5, // 81.1% of 336-hour Artemis window
    terrainProfile: createHorizonProfile(1.2, [
      { az: 140, el: 2.8, spread: 25 },
      { az: 220, el: 3.5, spread: 30 },
      { az: 310, el: 1.8, spread: 20 },
    ]),
  },
  'malapert-massif': {
    siteId: 'malapert-massif',
    sun: {
      azimuth: 88.2,
      elevation: 2.4,
      terrainElevationAtAzimuth: 1.1, // Demonstrates direct solar illumination
      isDemoData: true,
    },
    earth: {
      azimuth: 0.2,
      elevation: 5.6,
      terrainElevationAtAzimuth: 0.8, // Continuous direct line of sight from 5,000m peak
      isDemoData: true,
    },
    sunlightDurationHours: 242.0, // 72.0% of 336-hour Artemis window
    commVisibilityDurationHours: 329.0, // 97.9% continuous visibility
    terrainProfile: createHorizonProfile(0.8, [
      { az: 90, el: 1.5, spread: 35 },
      { az: 200, el: 2.2, spread: 25 },
    ]),
  },
  'connecting-ridge': {
    siteId: 'connecting-ridge',
    sun: {
      azimuth: 215.1,
      elevation: -0.85, // Demonstrates negative elevation / sub-horizon Sun
      terrainElevationAtAzimuth: 2.2,
      isDemoData: true,
    },
    earth: {
      azimuth: 137.5,
      elevation: 2.1,
      terrainElevationAtAzimuth: 1.8,
      isDemoData: true,
    },
    sunlightDurationHours: 215.0, // 64.0% of 336-hour Artemis window
    commVisibilityDurationHours: 245.0, // 72.9% of 336-hour Artemis window
    terrainProfile: createHorizonProfile(1.5, [
      { az: 45, el: 3.2, spread: 20 },
      { az: 215, el: 2.4, spread: 30 },
    ]),
  },
  'nobile-crater': {
    siteId: 'nobile-crater',
    sun: {
      azimuth: 48.6,
      elevation: 3.1,
      terrainElevationAtAzimuth: 1.5,
      isDemoData: true,
    },
    earth: {
      azimuth: 306.4,
      elevation: -1.4, // Demonstrates negative elevation / sub-horizon Earth (Earthset)
      terrainElevationAtAzimuth: 1.8,
      isDemoData: true,
    },
    sunlightDurationHours: 208.5, // 62.1% of 336-hour Artemis window
    commVisibilityDurationHours: 228.0, // 67.9% of 336-hour Artemis window
    terrainProfile: createHorizonProfile(1.4, [
      { az: 50, el: 2.1, spread: 25 },
      { az: 300, el: 3.8, spread: 40 },
    ]),
  },
};
