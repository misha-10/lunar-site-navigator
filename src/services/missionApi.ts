import type {
  LunarSite,
  CelestialPosition,
  TimelineDataPoint,
  SiteTimelineSeries,
} from '../types/mission';
import type {
  GetSitesResponse,
  MissionCalculateRequest,
  MissionCalculateResponse,
  MissionTimelineRequest,
  MissionTimelineResponse,
  ScenarioCompareRequest,
  MissionCompareResponse,
} from '../types/api';
import { LUNAR_DEMONSTRATION_SITES } from '../data/lunarSites';
import { DEMONSTRATION_CELESTIAL_DATA } from '../data/demonstrationCelestial';
import { generateSiteTimelineSeries } from '../data/demonstrationTimeline';

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';

export interface BackendConnectionStatus {
  isConnected: boolean;
  endpoint: string;
  latencyMs?: number;
  lastChecked?: string;
  error?: string;
}

class MissionApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  public setBaseUrl(newUrl: string) {
    this.baseUrl = newUrl;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Health check to detect if the backend server is listening
   */
  async checkHealth(): Promise<BackendConnectionStatus> {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
      }).catch(async () => {
        // Fallback probe to /sites if /health is not implemented
        return await fetch(`${this.baseUrl}/sites`, { signal: controller.signal });
      });

      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - start);

      if (res && res.ok) {
        return {
          isConnected: true,
          endpoint: this.baseUrl,
          latencyMs,
          lastChecked: new Date().toISOString(),
        };
      }
      return {
        isConnected: false,
        endpoint: this.baseUrl,
        lastChecked: new Date().toISOString(),
        error: `HTTP ${res.status}`,
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
   * Retrieves verified landing candidate sites from backend or fallback presets.
   */
  async getSites(): Promise<LunarSite[]> {
    try {
      const res = await fetch(`${this.baseUrl}/sites`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data: GetSitesResponse = await res.json();
        if (data.sites && Array.isArray(data.sites) && data.sites.length > 0) {
          return data.sites;
        }
      }
    } catch {
      // Backend offline: Return demonstration presets
    }
    return LUNAR_DEMONSTRATION_SITES;
  }

  /**
   * 2. POST /mission/calculate
   * Instantaneous solar & Earth ephemeris calculation for a specific timestamp
   */
  async calculateInstantaneous(
    req: MissionCalculateRequest
  ): Promise<{ sun: CelestialPosition; earth: CelestialPosition; isLive: boolean }> {
    try {
      const res = await fetch(`${this.baseUrl}/mission/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });

      if (res.ok) {
        const data: MissionCalculateResponse = await res.json();
        return {
          sun: {
            azimuth: data.sun.azimuth_deg,
            elevation: data.sun.elevation_deg,
            terrainElevationAtAzimuth: data.sun.terrain_crest_elevation_deg,
            isDemoData: data.data_status === 'demonstration_simulation',
          },
          earth: {
            azimuth: data.earth.azimuth_deg,
            elevation: data.earth.elevation_deg,
            terrainElevationAtAzimuth: data.earth.terrain_crest_elevation_deg,
            isDemoData: data.data_status === 'demonstration_simulation',
          },
          isLive: data.data_status === 'live_ephemeris',
        };
      }
    } catch {
      // Fallback
    }

    const base =
      DEMONSTRATION_CELESTIAL_DATA[req.site_id || ''] ||
      DEMONSTRATION_CELESTIAL_DATA['shackleton-crater'];
    return {
      sun: base.sun,
      earth: base.earth,
      isLive: false,
    };
  }

  /**
   * 3. POST /mission/timeline
   * Generates full 14-day (336-hour) mission ephemeris time series
   */
  async getTimelineSeries(req: MissionTimelineRequest): Promise<SiteTimelineSeries> {
    try {
      const res = await fetch(`${this.baseUrl}/mission/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });

      if (res.ok) {
        const data: MissionTimelineResponse = await res.json();

        // Convert backend samples to frontend TimelineDataPoints
        const points: TimelineDataPoint[] = data.samples.map((s) => ({
          stepIndex: s.step_index,
          timestamp: s.timestamp,
          label: `D${Math.floor(s.mission_elapsed_hours / 24) + 1} ${String(s.mission_elapsed_hours % 24).padStart(2, '0')}:00`,
          missionHour: s.mission_elapsed_hours,
          sunAzimuth: s.sun_azimuth_deg,
          sunElevation: s.sun_elevation_deg,
          terrainElevationAtSunAz: s.terrain_crest_sun_deg,
          isSunGeometricVisible: s.is_sun_geometric_visible,
          isSunlit: s.is_sunlit,
          earthAzimuth: s.earth_azimuth_deg,
          earthElevation: s.earth_elevation_deg,
          terrainElevationAtEarthAz: s.terrain_crest_earth_deg,
          isEarthGeometricVisible: s.is_earth_geometric_visible,
          hasEarthComm: s.has_earth_comm,
          isDemoData: data.data_status === 'demonstration_simulation',
        }));

        return {
          siteId: data.site_id,
          missionStartUtc: data.start_time,
          totalHours: data.duration_hours,
          points,
          summary: {
            totalSunlightHours: data.summary.total_sampled_sunlight_hours,
            sunlightPercentage: data.summary.sunlight_percentage,
            longestContinuousDarknessHours: data.summary.longest_continuous_darkness_hours,
            totalCommHours: data.summary.total_sampled_comm_hours,
            commPercentage: data.summary.comm_percentage,
            maxSolarElevation: data.summary.max_sun_elevation_deg ?? 0,
            minSolarElevation: data.summary.min_sun_elevation_deg ?? 0,
            maxEarthElevation: data.summary.max_earth_elevation_deg ?? 0,
            minEarthElevation: data.summary.min_earth_elevation_deg ?? 0,
          },
          isDemoData: data.data_status === 'demonstration_simulation',
        };
      }
    } catch {
      // Backend offline fallback
    }

    return generateSiteTimelineSeries(req.site_id || 'shackleton-crater', req.start_time);
  }

  /**
   * 4. POST /mission/compare
   * Evaluates 2 or 3 scenarios on the backend
   */
  async compareScenarios(req: ScenarioCompareRequest): Promise<MissionCompareResponse | null> {
    try {
      const res = await fetch(`${this.baseUrl}/mission/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback handled in client
    }
    return null;
  }
}

export const missionApi = new MissionApiService();
export default missionApi;
