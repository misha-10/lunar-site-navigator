import type { LunarSite } from '../types/mission';

/**
 * Lunar South Pole Candidate Landing Sites Catalogue
 * Normalized to match backend `SiteListResponse` and `Site` Pydantic models from `backend/app/schemas/site.py`.
 *
 * Coordinate Convention:
 * - latitude_deg [-90.0, 90.0] (negative south)
 * - longitude_deg [-180.0, 180.0] (east-positive)
 */
export const LUNAR_DEMONSTRATION_SITES: LunarSite[] = [
  {
    id: 'shackleton_region',
    name: 'Shackleton Crater region',
    latitude_deg: -89.9,
    longitude_deg: 0.0,
    latitude: -89.9,
    longitude: 0.0,
    coordinate_status: 'approximate_region_center',
    description:
      'Candidate exploration region near the lunar south pole encompassing elevated crater rim terrain and adjacent permanently shadowed regions (PSRs).',
    provenance:
      'NASA Artemis III Candidate Landing Regions / IAU Lunar Gazetteer (Shackleton crater center 89.9°S, 0.0°E; rim elevation features up to 89.65°S).',
    isVerified: true,
    coordinateSource:
      'NASA Artemis III Candidate Landing Regions / IAU Lunar Gazetteer',
    elevation_m: 1840,
  },
  {
    id: 'malapert_massif',
    name: 'Malapert Massif',
    latitude_deg: -85.99,
    longitude_deg: -2.93,
    latitude: -85.99,
    longitude: -2.93,
    coordinate_status: 'approximate_region_center',
    description:
      'High-altitude massif (~5 km elevation above surrounding terrain) on the South Pole-Aitken basin rim, offering favorable Earth line-of-sight visibility and periods of extended solar illumination.',
    provenance:
      'NASA Artemis Candidate Landing Regions / LROC LOLA topographic studies (~85.99°S, 357.07°E / -2.93°E in East-positive system).',
    isVerified: true,
    coordinateSource:
      'NASA Artemis Candidate Landing Regions / LROC LOLA topographic studies',
    elevation_m: 5020,
  },
  {
    id: 'connecting_ridge',
    name: 'Connecting Ridge',
    latitude_deg: -89.44,
    longitude_deg: -137.3,
    latitude: -89.44,
    longitude: -137.3,
    coordinate_status: 'approximate_region_center',
    description:
      'Prominent upland ridge feature connecting Shackleton crater toward de Gerlache and Henson craters, identified as a candidate region balancing solar accessibility and volatile prospecting proximity.',
    provenance:
      'NASA Artemis III Candidate Landing Region Studies (~89.44°S to 89.53°S, 209.95°E to 222.7°E / -137.3°E in East-positive system).',
    isVerified: true,
    coordinateSource:
      'NASA Artemis III Candidate Landing Region Studies',
    elevation_m: 1650,
  },
  {
    id: 'nobile_crater_region',
    name: 'Nobile Crater region',
    latitude_deg: -85.28,
    longitude_deg: 37.8,
    latitude: -85.28,
    longitude: 37.8,
    coordinate_status: 'approximate_region_center',
    description:
      'Highland terrain and ancient crater rim region prioritized for surface volatile investigation, near the prime landing area evaluated for VIPER and Artemis science objectives.',
    provenance:
      'NASA Artemis III Candidate Landing Regions (Nobile Rim 1/2) & VIPER Landing Site Studies (~85.28°S, 37.8°E in East-positive system).',
    isVerified: true,
    coordinateSource:
      'NASA Artemis III Candidate Landing Regions / VIPER Studies',
    elevation_m: 2100,
  },
];

export const DEFAULT_LUNAR_SITE: LunarSite = LUNAR_DEMONSTRATION_SITES[0];

/**
 * Mapping between legacy hyphenated frontend IDs and normalized backend IDs
 */
export const SITE_ID_ALIAS_MAP: Record<string, string> = {
  'shackleton-crater': 'shackleton_region',
  'malapert-massif': 'malapert_massif',
  'connecting-ridge': 'connecting_ridge',
  'nobile-crater': 'nobile_crater_region',
};

/**
 * Helper to resolve a site whether given a backend ID or legacy ID
 */
export function findSiteById(siteId: string): LunarSite | undefined {
  const normalizedId = SITE_ID_ALIAS_MAP[siteId] || siteId;
  return (
    LUNAR_DEMONSTRATION_SITES.find((s) => s.id === normalizedId) ||
    LUNAR_DEMONSTRATION_SITES.find((s) => s.id === siteId)
  );
}
