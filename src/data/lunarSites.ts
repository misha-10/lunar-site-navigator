import type { LunarSite } from '../types/mission';

export const LUNAR_DEMONSTRATION_SITES: LunarSite[] = [
  {
    id: 'shackleton-crater',
    name: 'Shackleton Crater Region',
    latitude: -89.90,
    longitude: 0.00,
    elevation_m: 1840,
    description:
      'Located directly at the lunar South Pole. Rim crests receive extensive continuous solar illumination while the crater interior remains in permanent cryogenic shadow.',
    isVerified: true,
    coordinateSource: 'NASA Artemis III Candidate Landing Regions / LRO LOLA',
  },
  {
    id: 'malapert-massif',
    name: 'Malapert Massif',
    latitude: -85.95,
    longitude: 0.00,
    elevation_m: 5020,
    description:
      'A prominent 5,000-meter elevated mountain massif providing superior direct-to-Earth communication visibility and extended seasonal solar exposure.',
    isVerified: true,
    coordinateSource: 'NASA Artemis III Candidate Regions / USGS Nomenclature',
  },
  {
    id: 'connecting-ridge',
    name: 'Connecting Ridge',
    latitude: -89.44,
    longitude: 222.50,
    elevation_m: 1650,
    description:
      'A narrow elevated saddle linking Shackleton Crater to the De Gerlache rim structure, characterized by grazing polar solar pathways and minimal shadow intervals.',
    isVerified: true,
    coordinateSource: 'NASA Artemis III Science Definition Report',
  },
  {
    id: 'nobile-crater',
    name: 'Nobile Crater Region',
    latitude: -85.25,
    longitude: 53.52,
    elevation_m: 2100,
    description:
      'Exploration corridor selected for NASA lunar surface robotics and Artemis sorties, featuring rolling polar terrain and accessible volatile-bearing micro-shadows.',
    isVerified: true,
    coordinateSource: 'NASA VIPER Mission Target / Artemis Candidate Region 07',
  },
];

export const DEFAULT_LUNAR_SITE: LunarSite = LUNAR_DEMONSTRATION_SITES[0];
