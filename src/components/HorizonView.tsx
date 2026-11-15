import React from 'react';
import { Compass } from 'lucide-react';
import type { CelestialPosition } from '../types/mission';
import { SunIndicator } from './SunIndicator';
import { EarthIndicator } from './EarthIndicator';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';

export interface HorizonViewProps {
  sunPosition: CelestialPosition;
  earthPosition: CelestialPosition;
  /** Optional 360-element array representing terrain elevation profile (0° to 359° azimuth) */
  terrainProfile?: number[];
  siteName?: string;
  isDemoData?: boolean;
  className?: string;
}

export const HorizonView: React.FC<HorizonViewProps> = ({
  sunPosition,
  earthPosition,
  terrainProfile,
  siteName = 'Local Horizon',
  isDemoData = true,
  className = '',
}) => {
  // Elevation scale configuration (-10° to +25° allows clear view of sub-horizon and polar grazing bodies)
  const minElevation = -10;
  const maxElevation = 25;
  const elRange = maxElevation - minElevation;

  // SVG Coordinate mapping helpers
  const svgWidth = 800;
  const svgHeight = 280;
  const padLeft = 45;
  const padRight = 25;
  const padTop = 30;
  const padBottom = 40;

  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const mapAzToX = (az: number) => {
    const normAz = ((az % 360) + 360) % 360;
    return padLeft + (normAz / 360) * plotWidth;
  };

  const mapElToY = (el: number) => {
    // Invert Y so positive elevation is up
    const clampedEl = Math.max(minElevation, Math.min(maxElevation, el));
    const ratio = (clampedEl - minElevation) / elRange;
    return padTop + plotHeight - ratio * plotHeight;
  };

  // Zero-degree local geometric horizon Y-coordinate
  const zeroHorizonY = mapElToY(0);

  // Validate Sun and Earth availability against NaN and unavailable status
  const isSunAvailable =
    !isNaN(sunPosition.elevation) &&
    isFinite(sunPosition.elevation) &&
    !isNaN(sunPosition.azimuth) &&
    isFinite(sunPosition.azimuth) &&
    sunPosition.status !== 'unavailable';

  const isEarthAvailable =
    !isNaN(earthPosition.elevation) &&
    isFinite(earthPosition.elevation) &&
    !isNaN(earthPosition.azimuth) &&
    isFinite(earthPosition.azimuth) &&
    earthPosition.status !== 'unavailable';

  // Position coordinates for Sun and Earth
  const sunX = isSunAvailable ? mapAzToX(sunPosition.azimuth) : 0;
  const sunY = isSunAvailable ? mapElToY(sunPosition.elevation) : 0;
  const isSunAboveHorizon = isSunAvailable && sunPosition.elevation >= 0;

  const earthX = isEarthAvailable ? mapAzToX(earthPosition.azimuth) : 0;
  const earthY = isEarthAvailable ? mapElToY(earthPosition.elevation) : 0;
  const isEarthAboveHorizon = isEarthAvailable && earthPosition.elevation >= 0;

  // Generate Terrain Silhouette Path if terrainProfile (360 points) is supplied
  let terrainPathD = '';
  let terrainAreaD = '';
  if (terrainProfile && terrainProfile.length === 360) {
    const points = terrainProfile.map((el, az) => {
      const x = mapAzToX(az);
      const y = mapElToY(el);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    terrainPathD = `M ${points.join(' L ')}`;
    // Close area down to 0° horizon line or bottom
    terrainAreaD = `M ${mapAzToX(0)},${zeroHorizonY} L ${points.join(' L ')} L ${mapAzToX(359)},${zeroHorizonY} Z`;
  }

  // Elevation grid tick steps
  const elevationTicks = [-10, -5, 0, 5, 10, 15, 20];

  // Azimuth grid tick steps
  const azimuthTicks = [
    { az: 0, label: '0° N' },
    { az: 45, label: '45° NE' },
    { az: 90, label: '90° E' },
    { az: 135, label: '135° SE' },
    { az: 180, label: '180° S' },
    { az: 225, label: '225° SW' },
    { az: 270, label: '270° W' },
    { az: 315, label: '315° NW' },
    { az: 360, label: '360° N' },
  ];

  const isLiveSpice = !isDemoData && sunPosition.data_mode === 'real_ephemeris';

  return (
    <Card className={`space-y-4 ${className}`}>
      {/* Top Header */}
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#38BDF8]/10 text-[#38BDF8] flex items-center justify-center border border-[#38BDF8]/20 shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-mono font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
                <span>Topocentric Horizon Coordinate View</span>
                {isLiveSpice ? (
                  <Badge variant="success" hasDot>
                    LIVE SPICE EPHEMERIS
                  </Badge>
                ) : isDemoData ? (
                  <Badge variant="neutral">
                    DEMO HORIZON
                  </Badge>
                ) : (
                  <Badge variant="warning">
                    CALCULATION UNAVAILABLE
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs font-mono text-slate-400">
                Azimuth [0°–360°] vs Elevation [-10° to +25°] relative to local tangent horizon plane ({siteName})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 hidden sm:inline">Reference Plane:</span>
            <span className="px-2 py-0.5 rounded bg-[#101827] border border-[#263449] text-[#38BDF8] font-bold">
              0.0° Tangent Plane
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Horizon 2D Cartesian Projection Canvas */}
        <div className="relative w-full rounded-lg bg-[#080D18] border border-[#263449] p-2 overflow-hidden select-none">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto overflow-visible"
            role="img"
            aria-label="Local lunar topocentric horizon chart showing Sun and Earth coordinates"
          >
            <defs>
              {/* Sky Background Gradient */}
              <linearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0B132B" />
                <stop offset="60%" stopColor="#080D18" />
                <stop offset="100%" stopColor="#030712" />
              </linearGradient>

              {/* Sub-horizon Shadow Gradient */}
              <linearGradient id="subHorizonGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1E293B" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#020617" stopOpacity="0.95" />
              </linearGradient>

              {/* Terrain Silhouette Area Fill */}
              <linearGradient id="terrainAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#334155" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#1E293B" stopOpacity="0.2" />
              </linearGradient>

              {/* Sun Marker Halo Gradient */}
              <radialGradient id="sunMarkerGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.8" />
                <stop offset="40%" stopColor="#FBBF24" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#FBBF24" stopOpacity="0" />
              </radialGradient>

              {/* Earth Marker Halo Gradient */}
              <radialGradient id="earthMarkerGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.8" />
                <stop offset="40%" stopColor="#60A5FA" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Background Canvas */}
            <rect
              x={padLeft}
              y={padTop}
              width={plotWidth}
              height={plotHeight}
              fill="url(#skyGradient)"
            />

            {/* 1. Sub-Horizon Area Shading (< 0° Elevation) */}
            <rect
              x={padLeft}
              y={zeroHorizonY}
              width={plotWidth}
              height={padTop + plotHeight - zeroHorizonY}
              fill="url(#subHorizonGradient)"
            />

            {/* 2. Elevation Grid Lines (Horizontal) */}
            {elevationTicks.map((el) => {
              const y = mapElToY(el);
              const isHorizon = el === 0;
              return (
                <g key={`el-${el}`}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={padLeft + plotWidth}
                    y2={y}
                    stroke={isHorizon ? '#38BDF8' : '#1E293B'}
                    strokeWidth={isHorizon ? 1.5 : 0.8}
                    strokeDasharray={isHorizon ? 'none' : '3 3'}
                    strokeOpacity={isHorizon ? 0.9 : 0.6}
                  />
                  {/* Elevation Y-Axis Label */}
                  <text
                    x={padLeft - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill={isHorizon ? '#38BDF8' : '#64748B'}
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight={isHorizon ? 'bold' : 'normal'}
                  >
                    {el > 0 ? `+${el}°` : `${el}°`}
                  </text>
                </g>
              );
            })}

            {/* 3. Azimuth Grid Lines (Vertical) */}
            {azimuthTicks.map(({ az, label }) => {
              const x = mapAzToX(az);
              const isCardinal = az % 90 === 0;
              return (
                <g key={`az-${az}`}>
                  <line
                    x1={x}
                    y1={padTop}
                    x2={x}
                    y2={padTop + plotHeight}
                    stroke={isCardinal ? '#334155' : '#1E293B'}
                    strokeWidth={isCardinal ? 1 : 0.6}
                    strokeDasharray={isCardinal ? '4 2' : '2 4'}
                    strokeOpacity={0.6}
                  />
                  {/* Azimuth X-Axis Label */}
                  <text
                    x={x}
                    y={padTop + plotHeight + 14}
                    textAnchor="middle"
                    fill={isCardinal ? '#94A3B8' : '#64748B'}
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight={isCardinal ? 'bold' : 'normal'}
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* 4. Local Topographic Silhouette (Illustrative / Pending LOLA DEM) */}
            {terrainPathD && (
              <g opacity="0.6">
                <path d={terrainAreaD} fill="url(#terrainAreaGradient)" />
                <path
                  d={terrainPathD}
                  fill="none"
                  stroke="#475569"
                  strokeWidth="1.2"
                  strokeDasharray="3 2"
                />
              </g>
            )}

            {/* Zero-Degree Geometric Horizon Line Accent */}
            <line
              x1={padLeft}
              y1={zeroHorizonY}
              x2={padLeft + plotWidth}
              y2={zeroHorizonY}
              stroke="#38BDF8"
              strokeWidth="1.5"
            />

            {/* Horizon Label Tag */}
            <text
              x={padLeft + 6}
              y={zeroHorizonY - 4}
              fill="#38BDF8"
              fontSize="8.5"
              fontFamily="monospace"
              fontWeight="bold"
            >
              0.0° LOCAL GEOMETRIC HORIZON (TANGENT PLANE)
            </text>

            {/* 5. Sun Indicator Marker on the Plot */}
            {isSunAvailable && (
              <g className="transition-all duration-300">
                {/* Vertical Guide to Azimuth Axis */}
                <line
                  x1={sunX}
                  y1={sunY}
                  x2={sunX}
                  y2={padTop + plotHeight}
                  stroke="#FBBF24"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  strokeOpacity={isSunAboveHorizon ? 0.6 : 0.3}
                />

                {/* Sun Marker Glyph (Amber) */}
                {isSunAboveHorizon ? (
                  <>
                    {/* Glowing Aura */}
                    <circle
                      cx={sunX}
                      cy={sunY}
                      r="12"
                      fill="url(#sunMarkerGlow)"
                    />
                    <circle
                      cx={sunX}
                      cy={sunY}
                      r="5"
                      fill="#FBBF24"
                      stroke="#FFFFFF"
                      strokeWidth="1"
                    />
                  </>
                ) : (
                  /* Sub-horizon Sun (Dimmed / Dashed) */
                  <g opacity="0.5">
                    <circle
                      cx={sunX}
                      cy={sunY}
                      r="5"
                      fill="#451A03"
                      stroke="#FBBF24"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1={sunX - 7}
                      y1={sunY}
                      x2={sunX + 7}
                      y2={sunY}
                      stroke="#FBBF24"
                      strokeWidth="0.8"
                    />
                  </g>
                )}

                {/* Sun Label Badge */}
                <g transform={`translate(${sunX}, ${isSunAboveHorizon ? sunY - 14 : sunY + 16})`}>
                  <rect
                    x="-42"
                    y="-10"
                    width="84"
                    height="16"
                    rx="3"
                    fill="#101827"
                    stroke={isSunAboveHorizon ? '#FBBF24' : '#475569'}
                    strokeWidth="0.8"
                  />
                  <text
                    x="0"
                    y="2"
                    textAnchor="middle"
                    fill={isSunAboveHorizon ? '#FBBF24' : '#94A3B8'}
                    fontSize="8"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    SUN ({sunPosition.elevation >= 0 ? `+${sunPosition.elevation.toFixed(1)}°` : `${sunPosition.elevation.toFixed(1)}°`})
                  </text>
                </g>
              </g>
            )}

            {/* 6. Earth Indicator Marker on the Plot */}
            {isEarthAvailable && (
              <g className="transition-all duration-300">
                {/* Vertical Guide to Azimuth Axis */}
                <line
                  x1={earthX}
                  y1={earthY}
                  x2={earthX}
                  y2={padTop + plotHeight}
                  stroke="#60A5FA"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  strokeOpacity={isEarthAboveHorizon ? 0.6 : 0.3}
                />

                {/* Earth Marker Glyph (Blue) */}
                {isEarthAboveHorizon ? (
                  <>
                    {/* Earth Glow Aura */}
                    <circle
                      cx={earthX}
                      cy={earthY}
                      r="11"
                      fill="url(#earthMarkerGlow)"
                    />
                    <circle
                      cx={earthX}
                      cy={earthY}
                      r="4.5"
                      fill="#60A5FA"
                      stroke="#FFFFFF"
                      strokeWidth="1"
                    />
                  </>
                ) : (
                  /* Sub-horizon Earth (Dimmed / Dashed) */
                  <g opacity="0.5">
                    <circle
                      cx={earthX}
                      cy={earthY}
                      r="4.5"
                      fill="#1E293B"
                      stroke="#60A5FA"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                  </g>
                )}

                {/* Earth Label Badge */}
                <g transform={`translate(${earthX}, ${isEarthAboveHorizon ? earthY - 14 : earthY + 16})`}>
                  <rect
                    x="-46"
                    y="-10"
                    width="92"
                    height="16"
                    rx="3"
                    fill="#101827"
                    stroke={isEarthAboveHorizon ? '#60A5FA' : '#475569'}
                    strokeWidth="0.8"
                  />
                  <text
                    x="0"
                    y="2"
                    textAnchor="middle"
                    fill={isEarthAboveHorizon ? '#60A5FA' : '#94A3B8'}
                    fontSize="8"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    EARTH ({earthPosition.elevation >= 0 ? `+${earthPosition.elevation.toFixed(1)}°` : `${earthPosition.elevation.toFixed(1)}°`})
                  </text>
                </g>
              </g>
            )}
          </svg>

          {/* Plot Legend & Scientific Convention Footer */}
          <div className="mt-2 pt-2 border-t border-[#263449] flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-[#38BDF8] inline-block" />
                <span className="text-[#38BDF8] font-semibold">0.0° Geometric Horizon Plane</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24] inline-block" />
                <span>Sun ({!isSunAvailable ? 'Unavailable' : isSunAboveHorizon ? 'Above 0°' : 'Sub-Horizon'})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#60A5FA] inline-block" />
                <span>Earth ({!isEarthAvailable ? 'Unavailable' : isEarthAboveHorizon ? 'Above 0°' : 'Sub-Horizon'})</span>
              </span>
            </div>
            <div className="text-slate-500">
              CONVENTION: 0° DATUM = LOCAL TANGENT PLANE | EL &lt; 0° = SUB-HORIZON | LOCAL TERRAIN CREST PENDING LOLA DEM
            </div>
          </div>
        </div>

        {/* Dedicated Indicator Subsystem Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SunIndicator position={sunPosition} />
          <EarthIndicator position={earthPosition} />
        </div>
      </CardContent>
    </Card>
  );
};

export default HorizonView;
