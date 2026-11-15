import React from 'react';
import { Globe, Radio, EyeOff, AlertCircle } from 'lucide-react';
import type { CelestialPosition } from '../types/mission';
import { Badge } from './ui/Badge';

export interface EarthIndicatorProps {
  position: CelestialPosition;
  compact?: boolean;
  className?: string;
}

export const EarthIndicator: React.FC<EarthIndicatorProps> = ({
  position,
  compact = false,
  className = '',
}) => {
  const {
    azimuth,
    elevation,
    terrainElevationAtAzimuth,
    isDemoData = true,
    data_mode,
    reason,
  } = position;

  // Scientific validation: Guard against NaN, null, and unavailable calculations
  const isAvailable =
    !isNaN(elevation) &&
    isFinite(elevation) &&
    !isNaN(azimuth) &&
    isFinite(azimuth) &&
    position.status !== 'unavailable';

  // Scientific evaluation: Geometric elevation vs terrain visibility
  const isGeometricallyAboveHorizon = isAvailable && elevation >= 0;

  // Never claim terrain blockage if terrain was not evaluated
  const terrainEvaluated = terrainElevationAtAzimuth !== undefined && position.terrain_visible !== null;

  const isTerrainBlocked =
    isGeometricallyAboveHorizon &&
    terrainEvaluated &&
    terrainElevationAtAzimuth !== undefined &&
    elevation < terrainElevationAtAzimuth;

  const hasLineOfSight = isGeometricallyAboveHorizon && !isTerrainBlocked;
  const isLiveSpice = !isDemoData && data_mode === 'real_ephemeris';

  // Compass cardinal calculation
  const getCardinal = (az: number): string => {
    if (!isAvailable) return '--';
    const norm = ((az % 360) + 360) % 360;
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round(norm / 22.5) % 16;
    return directions[idx];
  };

  if (compact) {
    return (
      <div className={`flex items-center justify-between p-2 rounded bg-[#080D18] border border-[#263449] ${className}`}>
        <div className="flex items-center gap-2">
          <Globe className={`w-4 h-4 ${hasLineOfSight ? 'text-[#60A5FA]' : 'text-slate-500'}`} />
          <span className="text-xs font-mono font-semibold text-slate-200">EARTH</span>
          {isLiveSpice ? (
            <Badge variant="success" hasDot>LIVE</Badge>
          ) : isDemoData ? (
            <Badge variant="neutral">Demo Data</Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-slate-400">
            Az: <strong className="text-slate-200">{isAvailable ? `${azimuth.toFixed(1)}°` : 'Unavailable'}</strong>
          </span>
          <span className={!isAvailable ? 'text-slate-500' : elevation >= 0 ? 'text-[#60A5FA] font-bold' : 'text-slate-500 font-bold'}>
            El: {!isAvailable ? 'Unavailable' : elevation >= 0 ? `+${elevation.toFixed(2)}°` : `${elevation.toFixed(2)}°`}
          </span>
          <Badge variant={!isAvailable ? 'neutral' : hasLineOfSight ? 'blue' : 'neutral'}>
            {!isAvailable ? 'Unavailable' : hasLineOfSight ? 'DTE Active' : isTerrainBlocked ? 'LOS Blocked' : 'Sub-Horizon'}
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-3.5 rounded-lg border transition-colors ${
        !isAvailable
          ? 'bg-[#101827] border-[#263449]'
          : hasLineOfSight
          ? 'bg-[#152033]/90 border-[#60A5FA]/40'
          : 'bg-[#101827] border-[#263449]'
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#263449]">
        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded flex items-center justify-center ${
              !isAvailable
                ? 'bg-slate-800 text-slate-500'
                : hasLineOfSight
                ? 'bg-[#60A5FA]/20 text-[#60A5FA]'
                : 'bg-slate-800 text-slate-500'
            }`}
          >
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold tracking-wider text-slate-100 uppercase">
              Earth Vector
            </h4>
            <span className="text-[10px] font-mono text-slate-400">
              Direct-To-Earth (DTE) Line of Sight (0° Horizon Plane)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isLiveSpice ? (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-bold">
              LIVE SPICE EPHEMERIS
            </span>
          ) : isDemoData ? (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#152033] text-sky-300/80 border border-sky-500/30">
              DEMO DATA
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/30">
              UNAVAILABLE
            </span>
          )}

          <Badge
            variant={
              !isAvailable
                ? 'neutral'
                : hasLineOfSight
                ? 'blue'
                : isTerrainBlocked
                ? 'warning'
                : 'neutral'
            }
            hasDot
          >
            {!isAvailable
              ? 'Unavailable'
              : hasLineOfSight
              ? 'DTE Link Open'
              : isTerrainBlocked
              ? 'LOS Obscured'
              : 'Sub-Horizon'}
          </Badge>
        </div>
      </div>

      {/* Main Coordinates Grid */}
      <div className="grid grid-cols-2 gap-3 py-2.5">
        {/* Azimuth */}
        <div className="p-2 rounded bg-[#080D18] border border-[#263449]/70">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            Azimuth Angle
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-sm font-mono font-bold text-slate-100">
              {isAvailable ? `${azimuth.toFixed(2)}°` : 'Unavailable'}
            </span>
            {isAvailable && (
              <span className="text-[10px] font-mono text-slate-400">
                ({getCardinal(azimuth)})
              </span>
            )}
          </div>
        </div>

        {/* Elevation */}
        <div className="p-2 rounded bg-[#080D18] border border-[#263449]/70">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            Elevation Angle
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span
              className={`text-sm font-mono font-bold ${
                !isAvailable
                  ? 'text-slate-500'
                  : elevation >= 0
                  ? 'text-[#60A5FA]'
                  : 'text-slate-500'
              }`}
            >
              {!isAvailable
                ? 'Unavailable'
                : elevation >= 0
                ? `+${elevation.toFixed(2)}°`
                : `${elevation.toFixed(2)}°`}
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              {!isAvailable
                ? 'No Ephemeris'
                : isGeometricallyAboveHorizon
                ? 'Above 0°'
                : 'Below 0°'}
            </span>
          </div>
        </div>
      </div>

      {/* Scientific Distinction: Geometric Elevation vs Terrain Horizon Blockage */}
      <div className="pt-2 border-t border-[#263449]/70 space-y-1.5 text-[11px] font-mono">
        <div className="flex items-center justify-between text-slate-400">
          <span>Geometric Elevation:</span>
          <span
            className={
              !isAvailable
                ? 'text-slate-500 font-semibold'
                : isGeometricallyAboveHorizon
                ? 'text-[#34D399] font-semibold'
                : 'text-[#F87171]'
            }
          >
            {!isAvailable
              ? 'Calculation Unavailable'
              : isGeometricallyAboveHorizon
              ? '≥ 0° (Above Tangent Plane)'
              : '< 0° (Sub-Horizon)'}
          </span>
        </div>

        {terrainEvaluated && terrainElevationAtAzimuth !== undefined ? (
          <div className="flex items-center justify-between text-slate-400">
            <span>Terrain Horizon Crest:</span>
            <span className="text-slate-200">
              +{terrainElevationAtAzimuth.toFixed(2)}°
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between text-slate-500 text-[10px]">
            <span>Topographic Terrain:</span>
            <span>Not Evaluated (Geometric Horizon Only)</span>
          </div>
        )}

        <div className="flex items-center justify-between text-slate-400">
          <span>Direct-To-Earth Comm Link:</span>
          <span
            className={`font-semibold flex items-center gap-1 ${
              !isAvailable
                ? 'text-slate-500'
                : hasLineOfSight
                ? 'text-[#60A5FA]'
                : isTerrainBlocked
                ? 'text-[#F87171]'
                : 'text-slate-500'
            }`}
          >
            {!isAvailable ? (
              <>
                <AlertCircle className="w-3 h-3 text-slate-500" />{' '}
                {reason ? `UNAVAILABLE: ${reason}` : 'EPHEMERIS UNAVAILABLE'}
              </>
            ) : hasLineOfSight ? (
              <>
                <Radio className="w-3 h-3 text-[#34D399]" /> DIRECT LINE-OF-SIGHT OK
              </>
            ) : isTerrainBlocked ? (
              <>
                <EyeOff className="w-3 h-3" /> DTE BLOCKED BY LOCAL TERRAIN
              </>
            ) : (
              <>
                <EyeOff className="w-3 h-3" /> NO DTE (BELOW LUNAR HORIZON)
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default EarthIndicator;
