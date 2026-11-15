/**
 * LunaScope Mission API Service Layer (Phase 2 - Adapter & Client Service)
 *
 * Connects frontend planning components to the FastAPI SPICE ephemeris backend.
 * Implements strict contract mapping, UTC timezone awareness, null preservation,
 * and scientific distinction between geometric and terrain-aware visibility.
 */

import type {
  LunarSite,
  CelestialPosition,
  TimelineDataPoint,
  SiteTimelineSeries,
  TimelineSummaryMetrics,
  EphemerisDataMode,
} from '../types/mission';
import type {
  SiteListResponse,
  MissionCalculateRequest,
  MissionCalculateResponse,
  CelestialBodyStatus,
  MissionMetadata,
  ScenarioResponse,
  TimelineResponse,
  MissionTimelineRequest,
  ComparisonRequest,
  ComparisonResponse,
  ScenarioDefinition,
  ScenarioCompareRequest,
} from '../types/api';
import { LUNAR_DEMONSTRATION_SITES, SITE_ID_ALIAS_MAP } from '../data/lunarSites';
import { DEMONSTRATION_CELESTIAL_DATA } from '../data/demonstrationCelestial';
import { generateSiteTimelineSeries } from '../data/demonstrationTimeline';

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';

export interface BackendConnectionStatus {
  isConnected: boolean;
  endpoint: string;
  latencyMs?: number;
  lastChecked?: string;
  service?: string;
  error?: string;
}

export interface InstantaneousCalculationResult {
  sun: CelestialPosition;
  earth: CelestialPosition;
  isLive: boolean;
  scenario?: ScenarioResponse;
  metadata?: MissionMetadata;
  error?: string;
}

/**
 * Helper to ensure a timestamp string is formatted as timezone-aware UTC ISO 8601 (ending with 'Z').
 */
function ensureUtcIsoString(rawTimestamp?: string | null): string {
  if (!rawTimestamp || !rawTimestamp.trim()) {
    return new Date().toISOString();
  }
  try {
    const parsed = new Date(rawTimestamp);
    if (isNaN(parsed.getTime())) {
      return new Date().toISOString();
    }
    return parsed.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Adapter: Maps backend CelestialBodyStatus to frontend CelestialPosition.
 *
 * Scientific Rules:
 * - Preserves null values in azimuth_deg and elevation_deg when calculations are unavailable.
 * - Never replaces null astronomical values with 0 (0° is a real position on the horizon).
 * - When unavailable, azimuth/elevation use NaN for number-type safety in UI consumers,
 *   ensuring `elevation >= 0` evaluates to false.
 */
function mapCelestialStatusToPosition(
  status: CelestialBodyStatus,
  dataMode: EphemerisDataMode
): CelestialPosition {
  const isAvailable =
    status.status === 'calculated' &&
    status.azimuth_deg !== null &&
    status.elevation_deg !== null;

  return {
    // Visualization numbers: NaN indicates missing/unavailable, never 0.0
    azimuth: isAvailable ? status.azimuth_deg! : Number.NaN,
    elevation: isAvailable ? status.elevation_deg! : Number.NaN,
    terrainElevationAtAzimuth: undefined,

    // Authoritative backend fields
    azimuth_deg: status.azimuth_deg,
    elevation_deg: status.elevation_deg,
    geometric_above_horizon: status.geometric_above_horizon,
    terrain_visible: status.terrain_visible,
    status: status.status,
    reason: status.reason,
    data_mode: dataMode,
    isDemoData: dataMode !== 'real_ephemeris',
  };
}

class MissionApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  public setBaseUrl(newUrl: string): void {
    this.baseUrl = newUrl;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Health Check: Detects backend status and ephemeris service readiness.
   */
  async checkHealth(): Promise<BackendConnectionStatus> {
    const start = performance.now();
    try {
      const primaryController = new AbortController();
      const primaryTimeoutId = setTimeout(() => primaryController.abort(), 7000);

      let res: Response | null = null;
      try {
        res = await fetch(`${this.baseUrl}/health`, {
          signal: primaryController.signal,
        });
      } catch {
        // Fallback probe to /sites if /health endpoint fails or times out
        const fallbackController = new AbortController();
        const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 7000);
        try {
          res = await fetch(`${this.baseUrl}/sites`, {
            signal: fallbackController.signal,
          });
        } finally {
          clearTimeout(fallbackTimeoutId);
        }
      } finally {
        clearTimeout(primaryTimeoutId);
      }
      const latencyMs = Math.round(performance.now() - start);

      if (res && res.ok) {
        let serviceName = 'lunascope-backend';
        try {
          const body = await res.json();
          if (body.service) serviceName = body.service;
        } catch {
          // Non-JSON response ok
        }

        return {
          isConnected: true,
          endpoint: this.baseUrl,
          latencyMs,
          service: serviceName,
          lastChecked: new Date().toISOString(),
        };
      }

      return {
        isConnected: false,
        endpoint: this.baseUrl,
        lastChecked: new Date().toISOString(),
        error: res ? `HTTP ${res.status}` : 'No response from server',
      };
    } catch (err: any) {
      return {
        isConnected: false,
        endpoint: this.baseUrl,
        lastChecked: new Date().toISOString(),
        error: err.name === 'AbortError' ? 'Connection timed out' : 'Server unreachable',
      };
    }
  }

  /**
   * 1. GET /sites
   * Retrieves verified landing candidate sites from the backend catalogue.
   * Maps exact backend coordinates, status, and provenance.
   * Preserves offline demonstration fallback on network or backend failure.
   */
  async getSites(): Promise<LunarSite[]> {
    try {
      const res = await fetch(`${this.baseUrl}/sites`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data: SiteListResponse = await res.json();
        if (data && Array.isArray(data.sites) && data.sites.length > 0) {
          return data.sites.map((s): LunarSite => ({
            id: s.id,
            name: s.name,
            latitude_deg: s.latitude_deg,
            longitude_deg: s.longitude_deg,
            latitude: s.latitude_deg,
            longitude: s.longitude_deg,
            coordinate_status: s.coordinate_status,
            description: s.description,
            provenance: s.provenance,
            isVerified: s.coordinate_status !== 'illustrative',
            coordinateSource: s.provenance || data.metadata?.source || 'Curated Catalogue',
            elevation_m: undefined,
          }));
        }
      } else {
        console.warn(`[MissionApi] GET /sites returned HTTP ${res.status}. Falling back to demonstration presets.`);
      }
    } catch (err) {
      console.warn('[MissionApi] Network failure fetching /sites. Falling back to demonstration presets.', err);
    }

    return LUNAR_DEMONSTRATION_SITES;
  }

  /**
   * 2. POST /mission/calculate
   * Instantaneous solar & Earth ephemeris calculation for a specific timestamp.
   *
   * Features:
   * - Enforces timezone-aware UTC ISO 8601 formatting (e.g. '2027-01-15T12:00:00.000Z').
   * - Normalizes site IDs and coordinates to match backend schema.
   * - Correctly evaluates metadata.data_mode ('real_ephemeris' vs 'unavailable').
   * - Preserves null astronomical values; never replaces null with 0.
   * - Distinguishes HTTP errors from live calculations.
   */
  async calculateInstantaneous(
    req: MissionCalculateRequest
  ): Promise<InstantaneousCalculationResult> {
    const datetime_utc = ensureUtcIsoString(req.datetime_utc || req.timestamp);

    // Build payload matching backend MissionCalculateRequest
    const payload: Record<string, any> = {
      datetime_utc,
      observer_altitude_m: req.observer_altitude_m ?? req.elevation_m ?? 0.0,
    };

    if (req.site_id) {
      payload.site_id = SITE_ID_ALIAS_MAP[req.site_id] || req.site_id;
    } else {
      const lat = req.latitude_deg ?? req.latitude;
      const lon = req.longitude_deg ?? req.longitude;
      if (lat !== undefined && lon !== undefined) {
        payload.latitude_deg = lat;
        payload.longitude_deg = lon;
      }
    }

    try {
      const res = await fetch(`${this.baseUrl}/mission/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data: MissionCalculateResponse = await res.json();
        const dataMode = data.metadata?.data_mode || 'unavailable';
        const isLive =
          dataMode === 'real_ephemeris' &&
          data.sun?.status === 'calculated' &&
          data.earth?.status === 'calculated';

        return {
          sun: mapCelestialStatusToPosition(data.sun, dataMode),
          earth: mapCelestialStatusToPosition(data.earth, dataMode),
          isLive,
          scenario: data.scenario,
          metadata: data.metadata,
        };
      }

      const errorBody = await res.text().catch(() => `HTTP ${res.status}`);
      console.warn(`[MissionApi] POST /mission/calculate failed (${res.status}):`, errorBody);

      return {
        sun: {
          azimuth: Number.NaN,
          elevation: Number.NaN,
          status: 'unavailable',
          reason: `HTTP ${res.status}: ${errorBody}`,
          data_mode: 'unavailable',
          isDemoData: false,
        },
        earth: {
          azimuth: Number.NaN,
          elevation: Number.NaN,
          status: 'unavailable',
          reason: `HTTP ${res.status}: ${errorBody}`,
          data_mode: 'unavailable',
          isDemoData: false,
        },
        isLive: false,
        error: `HTTP ${res.status}: Calculation failed on backend`,
      };
    } catch (networkErr: any) {
      console.warn('[MissionApi] Network failure on /mission/calculate. Engaging marked demo fallback.', networkErr);
    }

    // Explicit demonstration fallback on offline network error
    const resolvedSiteId = req.site_id ? (SITE_ID_ALIAS_MAP[req.site_id] || req.site_id) : 'shackleton_region';
    const base =
      DEMONSTRATION_CELESTIAL_DATA[resolvedSiteId] ||
      DEMONSTRATION_CELESTIAL_DATA['shackleton-crater'] ||
      DEMONSTRATION_CELESTIAL_DATA['shackleton_region'];

    return {
      sun: {
        azimuth: base?.sun.azimuth ?? 90,
        elevation: base?.sun.elevation ?? 0.5,
        terrainElevationAtAzimuth: base?.sun.terrainElevationAtAzimuth,
        azimuth_deg: base?.sun.azimuth ?? 90,
        elevation_deg: base?.sun.elevation ?? 0.5,
        status: 'demonstration_placeholder',
        reason: 'Backend unreachable; demonstration placeholder data displayed.',
        data_mode: 'demonstration_fallback',
        isDemoData: true,
      },
      earth: {
        azimuth: base?.earth.azimuth ?? 350,
        elevation: base?.earth.elevation ?? 5.0,
        terrainElevationAtAzimuth: base?.earth.terrainElevationAtAzimuth,
        azimuth_deg: base?.earth.azimuth ?? 350,
        elevation_deg: base?.earth.elevation ?? 5.0,
        status: 'demonstration_placeholder',
        reason: 'Backend unreachable; demonstration placeholder data displayed.',
        data_mode: 'demonstration_fallback',
        isDemoData: true,
      },
      isLive: false,
      error: 'Backend unreachable: Using marked demonstration data',
    };
  }

  /**
   * 3. POST /mission/timeline
   * Evaluates time-series ephemeris and derived visibility windows.
   *
   * Constraints:
   * - Enforces 7-day maximum evaluation interval (clamping requested duration).
   * - Converts sampling step correctly into minutes (15 to 360).
   * - Does NOT claim terrain-aware visibility when `terrain_evaluated` is false.
   * - Calculates discrete sampled duration and continuous window duration separately.
   */
  async getTimelineSeries(req: MissionTimelineRequest): Promise<SiteTimelineSeries> {
    const rawStart = req.start_datetime_utc || req.start_time || new Date().toISOString();
    const start_datetime_utc = ensureUtcIsoString(rawStart);
    const startDate = new Date(start_datetime_utc);

    // Respect the 7-day maximum limit (168 hours)
    let requestedHours = 168;
    if (req.duration_hours !== undefined && req.duration_hours > 0) {
      requestedHours = Math.min(req.duration_hours, 168);
    } else if (req.end_datetime_utc) {
      const parsedEnd = new Date(req.end_datetime_utc);
      if (!isNaN(parsedEnd.getTime())) {
        const diffH = (parsedEnd.getTime() - startDate.getTime()) / (3600 * 1000);
        requestedHours = Math.min(Math.max(1, diffH), 168);
      }
    }

    const end_datetime_utc = new Date(
      startDate.getTime() + requestedHours * 3600 * 1000
    ).toISOString();

    // Convert step_minutes (15 to 360)
    let step_minutes = 30;
    if (req.step_minutes !== undefined) {
      step_minutes = Math.min(Math.max(15, req.step_minutes), 360);
    } else if (req.step_size_hours !== undefined) {
      step_minutes = Math.min(Math.max(15, Math.round(req.step_size_hours * 60)), 360);
    }

    // Ensure sample limit <= 700
    const estimatedSamples = Math.floor((requestedHours * 60) / step_minutes) + 2;
    if (estimatedSamples > 700) {
      step_minutes = Math.ceil((requestedHours * 60) / 690);
    }

    const payload: Record<string, any> = {
      start_datetime_utc,
      end_datetime_utc,
      step_minutes,
      observer_altitude_m: req.observer_altitude_m ?? (req as any).elevation_m ?? 0.0,
    };

    if (req.site_id) {
      payload.site_id = SITE_ID_ALIAS_MAP[req.site_id] || req.site_id;
    } else {
      const lat = req.latitude_deg ?? (req as any).latitude;
      const lon = req.longitude_deg ?? (req as any).longitude;
      if (lat !== undefined && lon !== undefined) {
        payload.latitude_deg = lat;
        payload.longitude_deg = lon;
      }
    }

    try {
      const res = await fetch(`${this.baseUrl}/mission/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data: TimelineResponse = await res.json();
        const startMs = new Date(data.scenario.start_datetime_utc).getTime();
        const terrainEvaluated = data.metadata.terrain_evaluated === true;
        const isDemo = data.metadata.data_mode !== 'real_ephemeris';

        // Map discrete samples to TimelineDataPoint[]
        const points: TimelineDataPoint[] = data.samples.map((s, idx) => {
          const sampleMs = new Date(s.datetime_utc).getTime();
          const elapsedHours = (sampleMs - startMs) / (3600 * 1000);
          const dayNum = Math.floor(elapsedHours / 24) + 1;
          const hourInDay = Math.floor(elapsedHours % 24);
          const minInHour = Math.floor((elapsedHours * 60) % 60);

          const label =
            minInHour === 0
              ? `D${dayNum} ${String(hourInDay).padStart(2, '0')}:00`
              : `D${dayNum} ${String(hourInDay).padStart(2, '0')}:${String(minInHour).padStart(2, '0')}`;

          const isSunGeom =
            s.sun.geometric_above_horizon ??
            (s.sun.elevation_deg !== null && s.sun.elevation_deg > 0);

          const isEarthGeom =
            s.earth.geometric_above_horizon ??
            (s.earth.elevation_deg !== null && s.earth.elevation_deg > 0);

          // Topographic rule: Do not claim terrain visibility when terrain_evaluated is false
          const isSunlit =
            terrainEvaluated && s.sun.terrain_visible !== null
              ? s.sun.terrain_visible
              : isSunGeom;

          const hasEarthComm =
            terrainEvaluated && s.earth.terrain_visible !== null
              ? s.earth.terrain_visible
              : isEarthGeom;

          return {
            stepIndex: idx,
            timestamp: s.datetime_utc,
            label,
            missionHour: Number(elapsedHours.toFixed(2)),
            sunAzimuth: s.sun.azimuth_deg !== null ? s.sun.azimuth_deg : Number.NaN,
            sunElevation: s.sun.elevation_deg,
            terrainElevationAtSunAz: terrainEvaluated
              ? s.sun.terrain_crest_elevation_deg ?? 0
              : 0,
            isSunGeometricVisible: isSunGeom,
            isSunlit,
            earthAzimuth: s.earth.azimuth_deg !== null ? s.earth.azimuth_deg : Number.NaN,
            earthElevation: s.earth.elevation_deg,
            terrainElevationAtEarthAz: terrainEvaluated
              ? s.earth.terrain_crest_elevation_deg ?? 0
              : 0,
            isEarthGeometricVisible: isEarthGeom,
            hasEarthComm,
            status:
              s.sun.status === 'calculated' && s.earth.status === 'calculated'
                ? 'calculated'
                : 'unavailable',
            isDemoData: isDemo,
          };
        });

        // Compute summary metrics strictly over evaluated timeline
        const totalDurationHours =
          (new Date(data.scenario.end_datetime_utc).getTime() - startMs) / (3600 * 1000);

        // Continuous interpolated visibility window duration sum
        const interpolatedSunlightHours = (data.sun_visibility_windows || []).reduce(
          (acc, w) => acc + (w.duration_hours || 0),
          0
        );
        const interpolatedCommHours = (data.earth_visibility_windows || []).reduce(
          (acc, w) => acc + (w.duration_hours || 0),
          0
        );

        // Discrete adjacent sample summation
        let totalSampledSunHours = 0;
        let totalSampledCommHours = 0;
        for (let i = 0; i < points.length - 1; i++) {
          const dt =
            (new Date(points[i + 1].timestamp).getTime() -
              new Date(points[i].timestamp).getTime()) /
            (3600 * 1000);
          if (points[i].isSunGeometricVisible && points[i + 1].isSunGeometricVisible) {
            totalSampledSunHours += dt;
          }
          if (points[i].isEarthGeometricVisible && points[i + 1].isEarthGeometricVisible) {
            totalSampledCommHours += dt;
          }
        }

        // Elevation statistics strictly across valid non-null samples
        const validSunElevations = points
          .map((p) => p.sunElevation)
          .filter((el): el is number => el !== null && !isNaN(el));

        const validEarthElevations = points
          .map((p) => p.earthElevation)
          .filter((el): el is number => el !== null && !isNaN(el));

        const maxSolarElevation =
          validSunElevations.length > 0 ? Math.max(...validSunElevations) : 0;
        const minSolarElevation =
          validSunElevations.length > 0 ? Math.min(...validSunElevations) : 0;
        const maxEarthElevation =
          validEarthElevations.length > 0 ? Math.max(...validEarthElevations) : 0;
        const minEarthElevation =
          validEarthElevations.length > 0 ? Math.min(...validEarthElevations) : 0;

        const meanSolarElevation =
          validSunElevations.length > 0
            ? validSunElevations.reduce((a, b) => a + b, 0) / validSunElevations.length
            : null;

        const meanEarthElevation =
          validEarthElevations.length > 0
            ? validEarthElevations.reduce((a, b) => a + b, 0) / validEarthElevations.length
            : null;

        // Longest continuous darkness interval
        let longestDarknessHours = 0;
        let currentDarknessHours = 0;
        for (let i = 0; i < points.length - 1; i++) {
          const dt =
            (new Date(points[i + 1].timestamp).getTime() -
              new Date(points[i].timestamp).getTime()) /
            (3600 * 1000);
          if (!points[i].isSunlit) {
            currentDarknessHours += dt;
            if (currentDarknessHours > longestDarknessHours) {
              longestDarknessHours = currentDarknessHours;
            }
          } else {
            currentDarknessHours = 0;
          }
        }

        const summary: TimelineSummaryMetrics = {
          totalSunlightHours: Number(interpolatedSunlightHours.toFixed(2)),
          sunlightPercentage:
            totalDurationHours > 0
              ? Number(((interpolatedSunlightHours / totalDurationHours) * 100).toFixed(1))
              : 0,
          longestContinuousDarknessHours: Number(longestDarknessHours.toFixed(2)),
          totalCommHours: Number(interpolatedCommHours.toFixed(2)),
          commPercentage:
            totalDurationHours > 0
              ? Number(((interpolatedCommHours / totalDurationHours) * 100).toFixed(1))
              : 0,
          maxSolarElevation: Number(maxSolarElevation.toFixed(2)),
          minSolarElevation: Number(minSolarElevation.toFixed(2)),
          maxEarthElevation: Number(maxEarthElevation.toFixed(2)),
          minEarthElevation: Number(minEarthElevation.toFixed(2)),
          total_sampled_geometric_visibility_hours: Number(totalSampledSunHours.toFixed(2)),
          interpolated_geometric_visibility_hours: Number(interpolatedSunlightHours.toFixed(2)),
          valid_sample_count: validSunElevations.length,
          meanSolarElevation: meanSolarElevation !== null ? Number(meanSolarElevation.toFixed(2)) : null,
          meanEarthElevation: meanEarthElevation !== null ? Number(meanEarthElevation.toFixed(2)) : null,
        };

        return {
          siteId: data.scenario.site_id || 'custom-coordinates',
          missionStartUtc: data.scenario.start_datetime_utc,
          totalHours: Number(totalDurationHours.toFixed(2)),
          points,
          summary,
          data_mode: data.metadata.data_mode,
          isDemoData: isDemo,
        };
      }

      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      console.warn(`[MissionApi] POST /mission/timeline returned HTTP ${res.status}:`, errText);
    } catch (networkErr) {
      console.warn('[MissionApi] Network failure on /mission/timeline. Falling back to demonstration generator.', networkErr);
    }

    // Fallback to demonstration generator clearly marked as demo
    const fallbackSiteId = req.site_id ? (SITE_ID_ALIAS_MAP[req.site_id] || req.site_id) : 'shackleton_region';
    return generateSiteTimelineSeries(fallbackSiteId, req.start_time);
  }

  /**
   * 4. POST /mission/compare
   * Multi-scenario comparison along a shared evaluation timeline.
   *
   * Constraints:
   * - Enforces 2 to 4 scenarios (clamping if necessary).
   * - Ensures scenario IDs are unique.
   * - Enforces common time-window limits (<= 7 days).
   * - Accurately maps sun_summary and earth_summary.
   */
  async compareScenarios(
    req: ComparisonRequest | ScenarioCompareRequest
  ): Promise<ComparisonResponse | null> {
    if (!req.scenarios || req.scenarios.length < 2) {
      console.error('[MissionApi] POST /mission/compare requires at least 2 scenarios.');
      return null;
    }

    // Clamp scenarios to backend limit of 2 to 4
    const selectedScenarios = req.scenarios.slice(0, 4);

    // Normalize scenario definitions ensuring unique scenario_ids
    const seenIds = new Set<string>();
    const normalizedScenarios: ScenarioDefinition[] = selectedScenarios.map((s, idx) => {
      let sId = s.scenario_id || `scenario_${idx + 1}`;
      if (seenIds.has(sId)) {
        sId = `${sId}_${idx + 1}`;
      }
      seenIds.add(sId);

      const siteId = s.site_id ? (SITE_ID_ALIAS_MAP[s.site_id] || s.site_id) : undefined;
      const def: ScenarioDefinition = {
        scenario_id: sId,
        name: s.name || s.label || (siteId ? siteId.replace(/_/g, ' ') : `Scenario ${idx + 1}`),
      };

      if (siteId) {
        def.site_id = siteId;
      } else {
        const lat = s.latitude_deg ?? s.latitude;
        const lon = s.longitude_deg ?? s.longitude;
        if (lat !== undefined && lon !== undefined) {
          def.latitude_deg = lat;
          def.longitude_deg = lon;
        }
      }

      if (s.observer_altitude_m !== undefined) {
        def.observer_altitude_m = s.observer_altitude_m;
      }

      return def;
    });

    const start_datetime_utc = ensureUtcIsoString(
      req.start_datetime_utc || (req as any).timestamp || new Date().toISOString()
    );
    const startDate = new Date(start_datetime_utc);

    // 7-day maximum (168 hours)
    let requestedHours = 168;
    if (req.duration_hours !== undefined && req.duration_hours > 0) {
      requestedHours = Math.min(req.duration_hours, 168);
    } else if (req.end_datetime_utc) {
      const parsedEnd = new Date(req.end_datetime_utc);
      if (!isNaN(parsedEnd.getTime())) {
        const diffH = (parsedEnd.getTime() - startDate.getTime()) / (3600 * 1000);
        requestedHours = Math.min(Math.max(1, diffH), 168);
      }
    }

    const end_datetime_utc = new Date(
      startDate.getTime() + requestedHours * 3600 * 1000
    ).toISOString();

    const step_minutes = Math.min(Math.max(15, req.step_minutes ?? 60), 360);

    const payload: ComparisonRequest = {
      scenarios: normalizedScenarios,
      start_datetime_utc,
      end_datetime_utc,
      step_minutes,
      observer_altitude_m: req.observer_altitude_m ?? 0.0,
    };

    try {
      const res = await fetch(`${this.baseUrl}/mission/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data: ComparisonResponse = await res.json();
        return data;
      }

      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      console.warn(`[MissionApi] POST /mission/compare returned HTTP ${res.status}:`, errText);
    } catch (networkErr) {
      console.warn('[MissionApi] Network failure on /mission/compare.', networkErr);
    }

    return null;
  }
}

export const missionApi = new MissionApiService();
export default missionApi;
