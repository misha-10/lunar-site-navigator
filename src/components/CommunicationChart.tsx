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
import { Radio, AlertTriangle, CheckCircle2, ShieldAlert, Wifi } from 'lucide-react';
import type { TimelineDataPoint, TimelineSummaryMetrics } from '../types/mission';
import { Card } from './ui/Card';

export interface CommunicationChartProps {
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

export const CommunicationChart: React.FC<CommunicationChartProps> = ({
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

  // Dynamic duration and tick interval calculation
  const totalHours =
    data.length > 1
      ? Math.max(1, Math.round(data[data.length - 1].missionHour - data[0].missionHour))
      : data.length;
  const totalDays = Math.max(1, Math.round(totalHours / 24));
  const xAxisInterval = Math.max(1, Math.floor(data.length / 8));

  // Check for any missing data in the series
  const missingDataCount = data.filter((p) => p.earthElevation === null || Number.isNaN(p.earthElevation)).length;

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
    const isMissing = pt.earthElevation === null;

    return (
      <div className="p-3 bg-[#080D18] border border-[#263449] rounded shadow-xl text-xs font-mono space-y-1.5 min-w-[230px]">
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
            <span>COMM TELEMETRY MISSING</span>
          </div>
        ) : (
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Earth Elevation:</span>
              <span className="font-bold text-[#60A5FA]">
                {pt.earthElevation !== null && pt.earthElevation > 0
                  ? `+${pt.earthElevation.toFixed(2)}°`
                  : `${pt.earthElevation?.toFixed(2)}°`}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Terrain Crest Obstruction:</span>
              <span className="text-slate-300">
                +{pt.terrainElevationAtEarthAz.toFixed(2)}°
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Earth Azimuth:</span>
              <span className="text-slate-300">{pt.earthAzimuth.toFixed(1)}°</span>
            </div>

            <div className="pt-1.5 border-t border-[#263449]/70 flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Direct-To-Earth:</span>
              {pt.hasEarthComm ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> DTE LINK ACTIVE
                </span>
              ) : pt.isEarthGeometricVisible ? (
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> OCCULTED BY CREST
                </span>
              ) : (
                <span className="text-slate-400 flex items-center gap-1">
                  SUB-HORIZON (EARTHSET)
                </span>
              )}
            </div>
          </div>
        )}

        {isDemoData ? (
          <div className="text-[9px] text-amber-500/70 border-t border-[#263449]/40 pt-1 text-center">
            DEMONSTRATION SIMULATION
          </div>
        ) : (
          <div className="text-[9px] text-[#34D399]/90 border-t border-[#263449]/40 pt-1 text-center font-bold">
            LIVE SPICE EPHEMERIS (DE421)
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
          <div className="w-6 h-6 rounded bg-[#60A5FA]/10 text-[#60A5FA] flex items-center justify-center shrink-0 border border-[#60A5FA]/20">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
                Earth Elevation & Direct-To-Earth (DTE) Comm Profile
              </h3>
              {isDemoData ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-300/80 border border-amber-500/25">
                  DEMO DATA
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30 font-bold">
                  LIVE SPICE EPHEMERIS
                </span>
              )}
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              {totalDays}-Earth-Day ({totalHours}-Hour) Lunar Libration Oscillation vs 0° Geometric Horizon
            </p>
          </div>
        </div>

        {/* Aggregated Duration Summary (computed over full time series) */}
        {summary && (
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <div className="px-2 py-1 rounded bg-[#080D18] border border-[#263449] flex items-center gap-1.5">
              <span className="text-slate-500">DTE COMM COVERAGE:</span>
              <span className="text-[#34D399] font-bold">
                {summary.totalCommHours}h ({summary.commPercentage}%)
              </span>
            </div>
            <div className="px-2 py-1 rounded bg-[#080D18] border border-[#263449] flex items-center gap-1.5">
              <span className="text-slate-500">LIBRATION RANGE:</span>
              <span className="text-[#60A5FA] font-bold">
                {summary.minEarthElevation > 0 ? `+${summary.minEarthElevation}°` : `${summary.minEarthElevation}°`} to +{summary.maxEarthElevation}°
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
              {/* Earth Elevation Gradient Fill */}
              <linearGradient id="earthElevationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#60A5FA" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />

            {/* X-Axis: Dynamic intervals for clear readability */}
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: '#263449' }}
              tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'monospace' }}
              interval={xAxisInterval}
            />

            {/* Y-Axis: Earth Elevation in Degrees (-2° to +8°) */}
            <YAxis
              domain={[-2.5, 8.5]}
              ticks={[-2, 0, 2, 4, 6, 8]}
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

            {/* Topographic Horizon Obstruction Crest Line (Terrain Height at Earth Azimuth) */}
            <Line
              type="monotone"
              dataKey="terrainElevationAtEarthAz"
              stroke="#78716C"
              strokeDasharray="2 2"
              strokeWidth={1.2}
              dot={false}
              name="Terrain Crest Angle"
              isAnimationActive={false}
            />

            {/* Earth Elevation Curve with Gradient Fill */}
            <Area
              type="monotone"
              dataKey="earthElevation"
              stroke="#60A5FA"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#earthElevationGradient)"
              connectNulls={false}
              name="Earth Elevation"
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

      {/* 3. Direct-to-Earth Comm Visibility Track (Timeline Bar) */}
      <div className="mt-2 pt-2 border-t border-[#263449]/70">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
          <span className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3 text-[#34D399]" />
            DIRECT-TO-EARTH (DTE) LINE-OF-SIGHT OVER TIME ({totalHours} HOURS)
          </span>
          <span className="text-[9px] text-slate-500">
            Green/Blue = DTE Link Active | Red/Dark = Occulted / Sub-Horizon
          </span>
        </div>

        {/* 336-block micro visibility strip */}
        <div className="w-full h-3 rounded bg-[#080D18] border border-[#263449] flex overflow-hidden">
          {data.map((pt, idx) => {
            const isSelected = idx === currentStepIndex;
            let bgColor = 'bg-slate-900';
            if (pt.earthElevation === null) {
              bgColor = 'bg-rose-950/60';
            } else if (pt.hasEarthComm) {
              bgColor = 'bg-[#34D399] hover:bg-emerald-300';
            } else if (pt.isEarthGeometricVisible) {
              bgColor = 'bg-rose-900/60'; // Occulted by terrain rim
            }

            return (
              <div
                key={pt.stepIndex}
                onClick={() => onSelectStep && onSelectStep(pt.stepIndex)}
                title={`${pt.label}: ${pt.hasEarthComm ? 'DTE Active' : 'No Comm'} (El: ${pt.earthElevation?.toFixed(1) ?? '--'}°)`}
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
            <span className="w-2.5 h-0.5 bg-[#60A5FA] rounded-full inline-block" /> Earth Elevation (°)
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

export default CommunicationChart;
