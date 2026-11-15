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

  // Position coordinates for Sun and Earth
  const sunX = mapAzToX(sunPosition.azimuth);
  const sunY = mapElToY(sunPosition.elevation);
  const isSunAboveHorizon = sunPosition.elevation >= 0;

  const earthX = mapAzToX(earthPosition.azimuth);
  const earthY = mapElToY(earthPosition.elevation);
  const isEarthAboveHorizon = earthPosition.elevation >= 0;

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

  return (
    <Card className={`space-y-4 ${className}`}>
      {/* Top Header */}
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[#152033] border border-[#263449] flex items-center justify-center text-[#38BDF8]">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>Local Horizon Visualization</CardTitle>
              {isDemoData && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  DEMO DATA
                </span>
              )}
            </div>
            <p className="text-[11px] font-mono text-slate-400">
              Site: <strong className="text-slate-200">{siteName}</strong> • Topocentric Tangent Plane (0° Datum)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="cyan" hasDot>
            360° Panorama
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main 360° Horizon Skyplot SVG */}
        <div className="relative w-full rounded-lg bg-[#080D18] border border-[#263449] p-3 overflow-hidden select-none">
          {/* Subtle Ambient Space Vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.03)_0%,transparent_60%)] pointer-events-none" />

          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto overflow-visible"
          >
            <defs>
              {/* Sub-horizon lunar bulk gradient */}
              <linearGradient id="lunarBulkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0B101C" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#05080E" stopOpacity="1" />
              </linearGradient>

              {/* Terrain blockage silhouette gradient */}
              <linearGradient id="terrainMaskGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1E293B" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#0F172A" stopOpacity="0.9" />
              </linearGradient>

              {/* Sun radial glow */}
              <radialGradient id="sunMarkerGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FBBF24" stopOpacity="1" />
                <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
              </radialGradient>

              {/* Earth radial glow */}
              <radialGradient id="earthMarkerGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#60A5FA" stopOpacity="1" />
                <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0" />
              </radialGradient>

              {/* Sub-horizon subterranean hatching pattern */}
              <pattern
                id="subterraneanHatch"
                width="10"
                height="10"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <line x1="0" y1="0" x2="0" y2="10" stroke="#162032" strokeWidth="1" />
              </pattern>
            </defs>

            {/* 1. Sub-Horizon Region (Negative Elevation: Below 0° Local Tangent Plane) */}
            <rect
              x={padLeft}
              y={zeroHorizonY}
              width={plotWidth}
              height={padTop + plotHeight - zeroHorizonY}
              fill="url(#lunarBulkGrad)"
            />
            <rect
              x={padLeft}
              y={zeroHorizonY}
              width={plotWidth}
              height={padTop + plotHeight - zeroHorizonY}
              fill="url(#subterraneanHatch)"
              opacity="0.6"
            />

            {/* Sub-horizon label watermark */}
            <text
              x={padLeft + plotWidth / 2}
              y={zeroHorizonY + 35}
              fill="#263449"
              fontSize="10"
              fontFamily="monospace"
              fontWeight="bold"
              letterSpacing="2"
              textAnchor="middle"
              className="select-none"
            >
              SUB-HORIZON ZONE • OCCULTED BY LUNAR BULK (ELEVATION &lt; 0°)
            </text>

            {/* 2. Optional Terrain Profile (Relief Occultation) */}
            {terrainAreaD && (
              <>
                <path d={terrainAreaD} fill="url(#terrainMaskGrad)" />
                <path
                  d={terrainPathD}
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="1.2"
                  strokeOpacity="0.75"
                />
              </>
            )}

            {/* 3. Elevation Grid Lines (Horizontal) */}
            {elevationTicks.map((el) => {
              const y = mapElToY(el);
              const isZero = el === 0;

              return (
                <g key={`el-${el}`}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={padLeft + plotWidth}
                    y2={y}
                    stroke={isZero ? '#38BDF8' : el < 0 ? '#1C273A' : '#1E293B'}
                    strokeWidth={isZero ? 1.8 : 0.8}
                    strokeDasharray={isZero ? 'none' : '2 4'}
                  />
                  {/* Elevation axis label */}
                  <text
                    x={padLeft - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill={isZero ? '#38BDF8' : el < 0 ? '#64748B' : '#94A3B8'}
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight={isZero ? 'bold' : 'normal'}
                  >
                    {el >= 0 ? `+${el}°` : `${el}°`}
                  </text>
                </g>
              );
            })}

            {/* Explicit 0.0° Local Horizon Datum Line Banner */}
            <g>
              <line
                x1={padLeft}
                y1={zeroHorizonY}
                x2={padLeft + plotWidth}
                y2={zeroHorizonY}
                stroke="#38BDF8"
                strokeWidth="1.6"
              />
              <rect
                x={padLeft + plotWidth - 190}
                y={zeroHorizonY - 14}
                width="185"
                height="13"
                rx="2"
                fill="#101827"
                stroke="#38BDF8"
                strokeWidth="0.8"
              />
              <text
                x={padLeft + plotWidth - 97}
                y={zeroHorizonY - 4}
                textAnchor="middle"
                fill="#38BDF8"
                fontSize="8"
                fontFamily="monospace"
                fontWeight="bold"
              >
                0.0° LOCAL GEOMETRIC HORIZON
              </text>
            </g>

            {/* 4. Azimuth Grid Lines & Cardinal Labels (Vertical) */}
            {azimuthTicks.map(({ az, label }) => {
              const x = mapAzToX(az);
              return (
                <g key={`az-${az}`}>
                  <line
                    x1={x}
                    y1={padTop}
                    x2={x}
                    y2={padTop + plotHeight}
                    stroke="#1E293B"
                    strokeWidth="0.8"
                    strokeDasharray="2 3"
                  />
                  <text
                    x={x}
                    y={padTop + plotHeight + 14}
                    textAnchor="middle"
                    fill="#94A3B8"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="500"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* 5. Sun Indicator Marker on the Plot */}
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
                  {/* Solar Glow Aura */}
                  <circle
                    cx={sunX}
                    cy={sunY}
                    r="12"
                    fill="url(#sunMarkerGlow)"
                    className="animate-pulse"
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
                /* Sub-horizon Sun (Dimmed / Dashed - Rule: never show below horizon as geometrically visible) */
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

            {/* 6. Earth Indicator Marker on the Plot */}
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
          </svg>

          {/* Plot Legend & Scientific Convention Footer */}
          <div className="mt-2 pt-2 border-t border-[#263449] flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-[#38BDF8] inline-block" />
                <span className="text-[#38BDF8] font-semibold">0.0° Geometric Horizon</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24] inline-block" />
                <span>Sun ({sunPosition.elevation >= 0 ? 'Above 0°' : 'Sub-Horizon'})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#60A5FA] inline-block" />
                <span>Earth ({earthPosition.elevation >= 0 ? 'Above 0°' : 'Sub-Horizon'})</span>
              </span>
            </div>
            <div className="text-slate-500">
              CONVENTION: 0° DATUM = LOCAL TANGENT PLANE | EL &lt; 0° = SUB-HORIZON
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
