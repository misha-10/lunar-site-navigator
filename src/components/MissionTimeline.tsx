import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sun,
  Radio,
  Sliders,
  Layers,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import type { SiteTimelineSeries, TimelineDataPoint } from '../types/mission';
import { IlluminationChart } from './IlluminationChart';
import { CommunicationChart } from './CommunicationChart';
import { Button } from './ui/Button';

export interface MissionTimelineProps {
  /** Complete 14-day time series data for the selected site */
  series: SiteTimelineSeries;
  /** Active timeline step index (0 to 335) */
  currentStepIndex: number;
  /** Callback triggered when the timeline epoch is changed */
  onStepChange: (newStepIndex: number) => void;
  /** Explicit indicator for demonstration data */
  isDemoData?: boolean;
  className?: string;
}

export type TimelineViewTab = 'all' | 'solar' | 'earth';

export const MissionTimeline: React.FC<MissionTimelineProps> = ({
  series,
  currentStepIndex,
  onStepChange,
  isDemoData = true,
  className = '',
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x, 2x, 5x
  const [activeTab, setActiveTab] = useState<TimelineViewTab>('all');
  const [simulateMissingData, setSimulateMissingData] = useState<boolean>(false);

  const totalSteps = series.points.length;
  const activePoint: TimelineDataPoint =
    series.points[currentStepIndex] || series.points[0];

  // Optional synthetic dataset with simulated telemetry gaps to test missing-data handling
  const displayData: TimelineDataPoint[] = React.useMemo(() => {
    if (!simulateMissingData) return series.points;
    return series.points.map((pt, idx) => {
      // Simulate telemetry dropout between hours 72-84 and 200-210
      if ((idx >= 72 && idx <= 84) || (idx >= 200 && idx <= 210)) {
        return {
          ...pt,
          sunElevation: null,
          earthElevation: null,
        };
      }
      return pt;
    });
  }, [series.points, simulateMissingData]);

  // Automated playback loop
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stepRef = useRef<number>(currentStepIndex);

  useEffect(() => {
    stepRef.current = currentStepIndex;
  }, [currentStepIndex]);

  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.max(50, Math.floor(250 / playbackSpeed));
      timerRef.current = setInterval(() => {
        const next = stepRef.current >= totalSteps - 1 ? 0 : stepRef.current + 1;
        if (next === 0) {
          setIsPlaying(false);
        }
        onStepChange(next);
      }, intervalMs);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, totalSteps, onStepChange]);

  // Step navigation helpers
  const handleJump = (step: number) => {
    const clamped = Math.max(0, Math.min(step, totalSteps - 1));
    onStepChange(clamped);
  };

  const handleStepDelta = (delta: number) => {
    handleJump(currentStepIndex + delta);
  };

  // Quick event search helper: find first step matching a condition
  const handleJumpToEvent = (eventType: 'shadow' | 'peakSun' | 'maxEarth') => {
    if (eventType === 'shadow') {
      const found = series.points.find((p, i) => i > currentStepIndex && !p.isSunlit);
      if (found) handleJump(found.stepIndex);
      else {
        const wrap = series.points.find((p) => !p.isSunlit);
        if (wrap) handleJump(wrap.stepIndex);
      }
    } else if (eventType === 'peakSun') {
      let maxEl = -999;
      let maxIdx = 0;
      series.points.forEach((p, i) => {
        if (p.sunElevation !== null && p.sunElevation > maxEl) {
          maxEl = p.sunElevation;
          maxIdx = i;
        }
      });
      handleJump(maxIdx);
    } else if (eventType === 'maxEarth') {
      let maxEl = -999;
      let maxIdx = 0;
      series.points.forEach((p, i) => {
        if (p.earthElevation !== null && p.earthElevation > maxEl) {
          maxEl = p.earthElevation;
          maxIdx = i;
        }
      });
      handleJump(maxIdx);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. Main Temporal Epoch & Playback Scrubber Control Panel */}
      <div className="p-4 rounded-lg bg-[#101827] border border-[#263449] space-y-4">
        {/* Top Header Row: Readout & Telemetry Status Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#263449]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#38BDF8]/10 text-[#38BDF8] flex items-center justify-center border border-[#38BDF8]/20 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
                  Mission Timeline Scrubber
                </span>
                {isDemoData && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-300/80 border border-amber-500/25">
                    DEMO SIMULATION
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-[#38BDF8] font-bold">
                  {activePoint.timestamp.replace('T', ' ').replace('.000Z', ' UTC')}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300 font-semibold">
                  T+{String(Math.floor(activePoint.missionHour / 24)).padStart(2, '0')}d{' '}
                  {String(activePoint.missionHour % 24).padStart(2, '0')}h:00m
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">
                  Step {activePoint.stepIndex + 1}/{totalSteps}
                </span>
              </div>
            </div>
          </div>

          {/* Real-time Subsystem Status at Selected Moment */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Solar Status Pill */}
            <div
              className={`px-2.5 py-1 rounded text-[11px] font-mono border flex items-center gap-1.5 ${
                activePoint.isSunlit
                  ? 'bg-amber-500/10 border-amber-500/30 text-[#FBBF24]'
                  : activePoint.isSunGeometricVisible
                  ? 'bg-amber-900/20 border-amber-700/40 text-amber-400'
                  : 'bg-slate-900/60 border-[#263449] text-slate-400'
              }`}
            >
              <Sun className="w-3.5 h-3.5 shrink-0" />
              <span>
                SUN: {activePoint.isSunlit ? 'SUNLIT' : activePoint.isSunGeometricVisible ? 'TERRAIN SHADOW' : 'SUB-HORIZON'}
              </span>
              <span className="font-bold">
                ({activePoint.sunElevation !== null && activePoint.sunElevation > 0 ? `+${activePoint.sunElevation.toFixed(1)}°` : `${activePoint.sunElevation?.toFixed(1) ?? '--'}°`})
              </span>
            </div>

            {/* Earth Comm Status Pill */}
            <div
              className={`px-2.5 py-1 rounded text-[11px] font-mono border flex items-center gap-1.5 ${
                activePoint.hasEarthComm
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-[#34D399]'
                  : activePoint.isEarthGeometricVisible
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-slate-900/60 border-[#263449] text-slate-400'
              }`}
            >
              <Radio className="w-3.5 h-3.5 shrink-0" />
              <span>
                EARTH DTE: {activePoint.hasEarthComm ? 'LINK ACTIVE' : activePoint.isEarthGeometricVisible ? 'OCCULTED' : 'SUB-HORIZON'}
              </span>
              <span className="font-bold">
                ({activePoint.earthElevation !== null && activePoint.earthElevation > 0 ? `+${activePoint.earthElevation.toFixed(1)}°` : `${activePoint.earthElevation?.toFixed(1) ?? '--'}°`})
              </span>
            </div>
          </div>
        </div>

        {/* 2. Interactive Scrubber Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>T+00d (Mission Start)</span>
            <span className="text-[#38BDF8] font-bold uppercase">
              Current Epoch: {activePoint.label} (Hour {activePoint.missionHour})
            </span>
            <span>T+14d (336h Epoch End)</span>
          </div>

          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={totalSteps - 1}
              step={1}
              value={currentStepIndex}
              onChange={(e) => onStepChange(Number(e.target.value))}
              aria-label="Mission Timeline Step Slider"
              className="w-full h-2 bg-[#080D18] rounded-lg appearance-none cursor-pointer border border-[#263449] accent-[#38BDF8] focus:outline-none focus:ring-1 focus:ring-[#38BDF8]"
            />
          </div>

          {/* Major Day Marker Labels Along Slider */}
          <div className="flex justify-between text-[9px] font-mono text-slate-600 px-1 pt-0.5">
            <span>D1</span>
            <span>D3</span>
            <span>D5</span>
            <span>D7</span>
            <span>D9</span>
            <span>D11</span>
            <span>D13</span>
            <span>D14</span>
          </div>
        </div>

        {/* 3. Playback Controls & Quick Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#263449]/70 text-xs font-mono">
          {/* Left: Playback Controls */}
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={isPlaying ? 'amber' : 'primary'}
              onClick={() => setIsPlaying(!isPlaying)}
              className="gap-1.5 font-bold"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? 'Pause' : 'Play Timeline'}
            </Button>

            <div className="h-5 w-px bg-[#263449] mx-1" />

            {/* Fine-Grained Step Navigation */}
            <Button
              size="xs"
              variant="secondary"
              onClick={() => handleJump(0)}
              title="Jump to Mission Start (T+0)"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => handleStepDelta(-24)}
              title="Previous Day (-24h)"
            >
              <SkipBack className="w-3 h-3" />
              <span className="hidden sm:inline">-24h</span>
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => handleStepDelta(-1)}
              title="Previous Hour (-1h)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>-1h</span>
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => handleStepDelta(1)}
              title="Next Hour (+1h)"
            >
              <span>+1h</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => handleStepDelta(24)}
              title="Next Day (+24h)"
            >
              <SkipForward className="w-3 h-3" />
              <span className="hidden sm:inline">+24h</span>
            </Button>

            {/* Playback Speed Multiplier */}
            <div className="ml-2 flex items-center bg-[#080D18] border border-[#263449] rounded p-0.5 text-[10px]">
              {([1, 2, 5] as const).map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-1.5 py-0.5 rounded transition ${
                    playbackSpeed === spd
                      ? 'bg-[#38BDF8] text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Right: Quick Event Jump Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 hidden md:inline uppercase">Jump To:</span>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => handleJumpToEvent('peakSun')}
              className="text-[10px]"
            >
              <Sparkles className="w-3 h-3 text-[#FBBF24]" />
              Peak Sun
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => handleJumpToEvent('shadow')}
              className="text-[10px]"
            >
              <Sliders className="w-3 h-3 text-amber-400" />
              Shadow Entry
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => handleJumpToEvent('maxEarth')}
              className="text-[10px]"
            >
              <Radio className="w-3 h-3 text-[#60A5FA]" />
              Max Libration
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Chart View Controls & Missing Data Verification Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        {/* Chart View Switcher Tabs */}
        <div className="flex items-center bg-[#101827] border border-[#263449] p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded text-xs transition flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-[#152033] text-[#38BDF8] border border-[#38BDF8]/40 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Dual Charts (Illumination & Comm)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('solar')}
            className={`px-3 py-1 rounded text-xs transition flex items-center gap-1.5 ${
              activeTab === 'solar'
                ? 'bg-[#152033] text-[#FBBF24] border border-[#FBBF24]/40 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Solar Illumination Only</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('earth')}
            className={`px-3 py-1 rounded text-xs transition flex items-center gap-1.5 ${
              activeTab === 'earth'
                ? 'bg-[#152033] text-[#60A5FA] border border-[#60A5FA]/40 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Earth Comm Only</span>
          </button>
        </div>

        {/* Missing Data Telemetry Simulator Toggle */}
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant={simulateMissingData ? 'warning' : 'secondary'}
            onClick={() => setSimulateMissingData(!simulateMissingData)}
            className="text-[11px]"
          >
            <AlertTriangle className="w-3 h-3" />
            {simulateMissingData ? 'Restore Telemetry' : 'Simulate Missing Telemetry Gaps'}
          </Button>
        </div>
      </div>

      {/* 3. Time-Series Recharts Visualizations */}
      <div className="space-y-4">
        {/* Illumination Chart */}
        {(activeTab === 'all' || activeTab === 'solar') && (
          <IlluminationChart
            data={displayData}
            currentStepIndex={currentStepIndex}
            onSelectStep={onStepChange}
            summary={series.summary}
            isDemoData={isDemoData}
          />
        )}

        {/* Communication Chart */}
        {(activeTab === 'all' || activeTab === 'earth') && (
          <CommunicationChart
            data={displayData}
            currentStepIndex={currentStepIndex}
            onSelectStep={onStepChange}
            summary={series.summary}
            isDemoData={isDemoData}
          />
        )}
      </div>
    </div>
  );
};

export default MissionTimeline;
