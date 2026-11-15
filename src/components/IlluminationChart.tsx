import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { Sun, AlertTriangle, Eye, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { TimelineDataPoint, TimelineSummaryMetrics } from '../types/mission';
import { Card } from './ui/Card';

export interface IlluminationChartProps {
  /** 14-day hourly time-series data */
  data: TimelineDataPoint[];
  /** Currently selected step index in the mission timeline (0 to 335) */
  currentStepIndex?: number;
  /** Callback when user clicks on a time point in the chart */
  onSelectStep?: (stepIndex: number) => void;
  /** Pre-aggregated summary metrics across the full time series */
  summary?: TimelineSummaryMetrics;
  /** Whether the chart is in a loading state */
  isLoading?: boolean;
  /** Explicit indicator for demonstration data */
  isDemoData?: boolean;
  className?: string;
}

export const IlluminationChart: React.FC<IlluminationChartProps> = ({
  data,
  currentStepIndex = 0,
  onSelectStep,
  summary,
  isLoading = false,
  isDemoData = true,
  className = '',
}) => {
  // Safe point retrieval for current step
  const activePoint = data[currentStepIndex] || data[0];

  // Check for any missing data in the series
  const missingDataCount = data.filter((p) => p.sunElevation === null).length;

  if (isLoading) {
    return (
      <Card className={`p-4 bg-[#101827] border-[#263449] animate-pulse h-80 flex flex-col justify-between ${className}`}>
        <div className="flex items-center justify-between">
          <div className="h-4 w-48 bg-[#1C273A] rounded" />
          <div className="h-4 w-24 bg-[#1C273A] rounded" />
        </div>
        <div className="h-48 w-full bg-[#1C273A]/60 rounded my-auto" />
        <div className="h-3 w-36 bg-[#1C273A] rounded" />
      </Card>
    );
  }

  // Custom Interactive Tooltip
  const renderCustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const pt: TimelineDataPoint = payload[0].payload;
    const isMissing = pt.sunElevation === null;

    return (
      <div className="p-3 bg-[#080D18] border border-[#263449] rounded shadow-xl text-xs font-mono space-y-1.5 min-w-[220px]">
        <div className="flex items-center justify-between border-b border-[#263449] pb-1.5">
          <span className="text-slate-300 font-bold">{pt.label}</span>
          <span className="text-[10px] text-slate-500">T+{pt.missionHour}h</span>
        </div>

        <div className="text-[10px] text-slate-400">
          {pt.timestamp.replace('T', ' ').replace('.000Z', ' UTC')}
        </div>

        {isMissing ? (
          <div className="flex items-center gap-1.5 text-rose-400 py-1 font-bold">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>TELEMETRY MISSING</span>
          </div>
        ) : (
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Solar Elevation:</span>
              <span className="font-bold text-[#FBBF24]">
                {pt.sunElevation !== null && pt.sunElevation > 0 ? `+${pt.sunElevation.toFixed(2)}°` : `${pt.sunElevation?.toFixed(2)}°`}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Horizon Crest:</span>
              <span className="text-slate-300">
                +{pt.terrainElevationAtSunAz.toFixed(2)}°
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Solar Azimuth:</span>
              <span className="text-slate-300">{pt.sunAzimuth.toFixed(1)}°</span>
            </div>

            <div className="pt-1.5 border-t border-[#263449]/70 flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Illumination:</span>
              {pt.isSunlit ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> SUNLIT (NOMINAL)
                </span>
              ) : pt.isSunGeometricVisible ? (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> TERRAIN SHADOW
                </span>
              ) : (
                <span className="text-slate-400 flex items-center gap-1">
                  SUB-HORIZON
                </span>
              )}
            </div>
          </div>
        )}

        {isDemoData && (
          <div className="text-[9px] text-amber-500/70 border-t border-[#263449]/40 pt-1 text-center">
            DEMONSTRATION SIMULATION
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className={`p-4 bg-[#101827] border-[#263449] flex flex-col justify-between ${className}`}>
      {/* 1. Header with Metadata & Pre-calculated Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-[#263449]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#FBBF24]/10 text-[#FBBF24] flex items-center justify-center shrink-0 border border-[#FBBF24]/20">
            <Sun className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
                Solar Elevation & Surface Illumination Profile
              </h3>
              {isDemoData && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-300/80 border border-amber-500/25">
                  DEMO DATA
                </span>
              )}
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              14-Earth-Day (336-Hour) Polar Solar Trajectory vs Topographic Horizon Crest
            </p>
          </div>
        </div>

        {/* Aggregated Duration Summary (computed over full time series) */}
        {summary && (
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <div className="px-2 py-1 rounded bg-[#080D18] border border-[#263449] flex items-center gap-1.5">
              <span className="text-slate-500">SUNLIT DURATION:</span>
              <span className="text-[#38BDF8] font-bold">
                {summary.totalSunlightHours}h ({summary.sunlightPercentage}%)
              </span>
            </div>
            <div className="px-2 py-1 rounded bg-[#080D18] border border-[#263449] flex items-center gap-1.5">
              <span className="text-slate-500">MAX SHADOW RUN:</span>
              <span className="text-amber-400 font-bold">
                {summary.longestContinuousDarknessHours}h
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Interactive Recharts Container */}
      <div className="h-56 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            onClick={(e) => {
              if (e && e.activeTooltipIndex !== undefined && onSelectStep) {
                onSelectStep(e.activeTooltipIndex);
              }
            }}
            margin={{ top: 10, right: 12, left: -18, bottom: 0 }}
          >
            <defs>
              {/* Solar Elevation Gradient Fill */}
              <linearGradient id="solarElevationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FBBF24" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#FBBF24" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />

            {/* X-Axis: 14 Days with readable tick intervals (every 48 hours / 2 days) */}
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: '#263449' }}
              tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'monospace' }}
              interval={47} // Tick roughly every 48 hours
            />

            {/* Y-Axis: Solar Elevation in Degrees (-3° to +5°) */}
            <YAxis
              domain={[-3.0, 4.5]}
              ticks={[-2, 0, 2, 4]}
              tickLine={false}
              axisLine={{ stroke: '#263449' }}
              tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'monospace' }}
              tickFormatter={(v: number) => (v > 0 ? `+${v}°` : `${v}°`)}
            />

            <Tooltip content={renderCustomTooltip} />

            {/* 0° Geometric Horizon Line */}
            <ReferenceLine
              y={0}
              stroke="#64748B"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: '0° Geometric Horizon',
                fill: '#64748B',
                fontSize: 9,
                fontFamily: 'monospace',
                position: 'insideBottomLeft',
              }}
            />

            {/* Topographic Horizon Obstruction Crest Line (Terrain Height at Sun Azimuth) */}
            <Line
              type="monotone"
              dataKey="terrainElevationAtSunAz"
              stroke="#78716C"
              strokeDasharray="2 2"
              strokeWidth={1.2}
              dot={false}
              name="Terrain Crest Angle"
              isAnimationActive={false}
            />

            {/* Solar Elevation Curve with Gradient Fill */}
            <Area
              type="monotone"
              dataKey="sunElevation"
              stroke="#FBBF24"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#solarElevationGradient)"
              connectNulls={false}
              name="Solar Elevation"
              isAnimationActive={false}
            />

            {/* Selected Mission Time Marker (Vertical Cyan Beacon) */}
            {activePoint && (
              <ReferenceLine
                x={activePoint.label}
                stroke="#38BDF8"
                strokeWidth={2}
                strokeDasharray="3 3"
                label={{
                  value: 'ACTIVE EPOCH',
                  fill: '#38BDF8',
                  fontSize: 8,
                  fontFamily: 'monospace',
                  position: 'top',
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 3. Surface Illumination Visibility Track (Timeline Bar) */}
      <div className="mt-2 pt-2 border-t border-[#263449]/70">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
          <span className="flex items-center gap-1.5">
            <Eye className="w-3 h-3 text-[#38BDF8]" />
            SURFACE ILLUMINATION STATUS OVER TIME (336 HOURS)
          </span>
          <span className="text-[9px] text-slate-500">
            Green = Direct Sunlit | Dark = Shadow / Sub-Horizon
          </span>
        </div>

        {/* 336-block micro visibility strip */}
        <div className="w-full h-3 rounded bg-[#080D18] border border-[#263449] flex overflow-hidden">
          {data.map((pt, idx) => {
            const isSelected = idx === currentStepIndex;
            let bgColor = 'bg-slate-900';
            if (pt.sunElevation === null) {
              bgColor = 'bg-rose-950/60';
            } else if (pt.isSunlit) {
              bgColor = 'bg-[#FBBF24] hover:bg-amber-300';
            } else if (pt.isSunGeometricVisible) {
              bgColor = 'bg-amber-900/60'; // Occulted by terrain
            }

            return (
              <div
                key={pt.stepIndex}
                onClick={() => onSelectStep && onSelectStep(pt.stepIndex)}
                title={`${pt.label}: ${pt.isSunlit ? 'Sunlit' : 'Shadow'} (El: ${pt.sunElevation?.toFixed(1) ?? '--'}°)`}
                className={`flex-1 h-full cursor-pointer transition-colors ${bgColor} ${
                  isSelected ? 'ring-1 ring-[#38BDF8] z-10 scale-y-125' : ''
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* 4. Chart Footer Legend & Missing Data Warning */}
      <div className="mt-2 pt-2 border-t border-[#263449]/50 flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-400 gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-0.5 bg-[#FBBF24] rounded-full inline-block" /> Solar Elevation (°)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-0.5 bg-[#78716C] border-b border-dashed inline-block" /> Terrain Crest Obstruction (°)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-0.5 bg-[#64748B] border-b border-dashed inline-block" /> 0° Horizon
          </span>
        </div>

        {missingDataCount > 0 && (
          <span className="text-rose-400 font-bold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {missingDataCount} Telemetry Gaps
          </span>
        )}
      </div>
    </Card>
  );
};

export default IlluminationChart;
