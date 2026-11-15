import React, { useState, useMemo } from 'react';
import {
  FileText,
  Compass,
  Clock,
  Sun,
  Radio,
  BatteryCharging,
  Wifi,
  AlertTriangle,
  Scale,
  CheckCircle2,
  Info,
  Sliders,
  Layers,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { useMission } from '../context/MissionContext';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

export interface FeasibilityWeights {
  sunlightWeight: number; // e.g. 0.40
  commWeight: number; // e.g. 0.35
  simultaneousWeight: number; // e.g. 0.25
}

export const MissionSummary: React.FC<{ className?: string }> = ({ className = '' }) => {
  const {
    selectedSite,
    missionDate,
    missionTime,
    selectedTimestampUtc,
    currentTimelineStep,
    currentTimelinePoint,
    timelineSeries,
    currentSunPosition,
    currentEarthPosition,
  } = useMission();

  // Transparent feasibility weighting state
  const [weights, setWeights] = useState<FeasibilityWeights>({
    sunlightWeight: 0.4,
    commWeight: 0.35,
    simultaneousWeight: 0.25,
  });

  const [activePreset, setActivePreset] = useState<'balanced' | 'solar' | 'comm'>('balanced');
  const [showFormulaDetails, setShowFormulaDetails] = useState<boolean>(false);

  // 1. Calculate operational windows across the full 336-hour series
  const windowMetrics = useMemo(() => {
    const points = timelineSeries.points;
    const total = points.length;

    let simultaneousCount = 0; // Sunlit AND DTE Comm
    let batteryOnlyCount = 0; // In shadow AND DTE Comm
    let solarOnlyCount = 0; // Sunlit AND No DTE Comm
    let survivalCount = 0; // In shadow AND No DTE Comm

    for (const pt of points) {
      const sun = pt.isSunlit;
      const comm = pt.hasEarthComm;

      if (sun && comm) simultaneousCount++;
      else if (!sun && comm) batteryOnlyCount++;
      else if (sun && !comm) solarOnlyCount++;
      else survivalCount++;
    }

    return {
      totalHours: total,
      simultaneousHours: simultaneousCount,
      simultaneousPct: Math.round((simultaneousCount / total) * 1000) / 10,
      batteryOnlyHours: batteryOnlyCount,
      batteryOnlyPct: Math.round((batteryOnlyCount / total) * 1000) / 10,
      solarOnlyHours: solarOnlyCount,
      solarOnlyPct: Math.round((solarOnlyCount / total) * 1000) / 10,
      survivalHours: survivalCount,
      survivalPct: Math.round((survivalCount / total) * 1000) / 10,
    };
  }, [timelineSeries.points]);

  // 2. Transparent Feasibility Evaluation (Explicit Formula)
  // Formula: Score = (w_sun * P_sun) + (w_comm * P_comm) + (w_sim * P_sim)
  const feasibilityScore = useMemo(() => {
    const pSun = timelineSeries.summary.sunlightPercentage;
    const pComm = timelineSeries.summary.commPercentage;
    const pSim = windowMetrics.simultaneousPct;

    const raw =
      weights.sunlightWeight * pSun +
      weights.commWeight * pComm +
      weights.simultaneousWeight * pSim;

    return Math.round(raw * 10) / 10;
  }, [timelineSeries.summary, windowMetrics.simultaneousPct, weights]);

  // Weight presets
  const handleApplyPreset = (preset: 'balanced' | 'solar' | 'comm') => {
    setActivePreset(preset);
    if (preset === 'balanced') {
      setWeights({ sunlightWeight: 0.4, commWeight: 0.35, simultaneousWeight: 0.25 });
    } else if (preset === 'solar') {
      setWeights({ sunlightWeight: 0.6, commWeight: 0.2, simultaneousWeight: 0.2 });
    } else if (preset === 'comm') {
      setWeights({ sunlightWeight: 0.2, commWeight: 0.6, simultaneousWeight: 0.2 });
    }
  };

  // Nuanced mission assessment (Non-pass/fail characterization)
  const missionCharacterization = useMemo(() => {
    const sunPct = timelineSeries.summary.sunlightPercentage;
    const commPct = timelineSeries.summary.commPercentage;

    if (sunPct > 80 && commPct > 80) {
      return {
        label: 'Dual-Optimal Operational Envelope',
        description:
          'High cumulative illumination with robust Direct-To-Earth line-of-sight. Excellent candidate for extended EVA schedules and continuous real-time mission telemetry.',
        color: 'text-emerald-400',
        badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
      };
    } else if (commPct >= 90 && sunPct < 75) {
      return {
        label: 'Comm-Priority Elevated Ridge Profile',
        description:
          'Superior, uninterrupted Earth visibility (~95%+) provided by high-elevation peak. Requires thermal energy storage or fuel cells to accommodate shadow intervals.',
        color: 'text-[#60A5FA]',
        badgeBg: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
      };
    } else if (sunPct >= 80 && commPct < 75) {
      return {
        label: 'Solar-Priority Illumination Profile',
        description:
          'Prolonged solar grazing angles maximize surface power generation, but topographic crests intermittently occult Direct-To-Earth line of sight. Relay satellite support recommended for blackout intervals.',
        color: 'text-[#FBBF24]',
        badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
      };
    }
    return {
      label: 'Constrained Subsystem Trade-Off Profile',
      description:
        'Subsystem constraints exist for both solar array exposure and direct RF visibility. Operational timing must be synchronized strictly with favorable libration and solar azimuth intervals.',
      color: 'text-slate-300',
      badgeBg: 'bg-slate-800 border-[#263449] text-slate-300',
    };
  }, [timelineSeries.summary]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. Header Banner: Executive Mission Assessment */}
      <div className="p-4 rounded-lg bg-[#101827] border border-[#263449] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#38BDF8]/10 text-[#38BDF8] flex items-center justify-center border border-[#38BDF8]/20 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-100">
                Mission Summary & Executive Assessment
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-300/80 border border-amber-500/25">
                DEMO EVALUATION
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400">
              Operational synthesis across solar, communications, and temporal mission constraints
            </p>
          </div>
        </div>

        {/* Selected Epoch Quick Reference */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="px-2.5 py-1 rounded bg-[#080D18] border border-[#263449] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span className="text-slate-400">EPOCH:</span>
            <span className="text-slate-200 font-bold">
              {missionDate} {missionTime} UTC
            </span>
            <span className="text-slate-500">(Step {currentTimelineStep + 1}/336)</span>
          </div>
        </div>
      </div>

      {/* 2. Top Overview: Landing Site & Mission Epoch Context (2-col grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Landing Target Site Profile */}
        <Card className="p-4 bg-[#101827] border-[#263449] space-y-3">
          <div className="flex items-center justify-between border-b border-[#263449] pb-2">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#38BDF8]" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
                Target Landing Site Specification
              </h3>
            </div>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                selectedSite.isVerified
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              {selectedSite.isVerified ? 'VERIFIED NASA CANDIDATE' : 'APPROXIMATE DEMO COORDINATES'}
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-baseline justify-between">
              <span className="text-slate-400">Site Name:</span>
              <span className="text-slate-100 font-bold text-sm">{selectedSite.name}</span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#263449]/50">
              <span className="text-slate-400">Coordinates:</span>
              <span className="text-[#38BDF8] font-bold">
                {Math.abs(selectedSite.latitude).toFixed(2)}°S, {selectedSite.longitude.toFixed(2)}°E
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#263449]/50">
              <span className="text-slate-400">Elevation Datum:</span>
              <span className="text-slate-300">
                {selectedSite.elevation_m !== undefined
                  ? `${selectedSite.elevation_m > 0 ? '+' : ''}${selectedSite.elevation_m.toLocaleString()} m`
                  : 'Reference Datum (0 m)'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#263449]/50">
              <span className="text-slate-400">Coordinate Source:</span>
              <span className="text-slate-400 text-[11px] truncate max-w-[220px]" title={selectedSite.coordinateSource}>
                {selectedSite.coordinateSource}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed font-sans pt-1">
              {selectedSite.description}
            </p>
          </div>
        </Card>

        {/* Temporal Mission Epoch & Duration Context */}
        <Card className="p-4 bg-[#101827] border-[#263449] space-y-3">
          <div className="flex items-center justify-between border-b border-[#263449] pb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FBBF24]" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
                Temporal Mission Epoch & Envelope
              </h3>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#152033] border border-[#263449] text-[#38BDF8]">
              14-DAY SURFACE WINDOW
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-baseline justify-between">
              <span className="text-slate-400">Selected Epoch (UTC):</span>
              <span className="text-[#FBBF24] font-bold">
                {selectedTimestampUtc.replace('T', ' ').replace('.000Z', ' UTC')}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#263449]/50">
              <span className="text-slate-400">Mission Elapsed Time:</span>
              <span className="text-slate-200 font-bold">
                T+{String(Math.floor(currentTimelinePoint.missionHour / 24)).padStart(2, '0')}d{' '}
                {String(currentTimelinePoint.missionHour % 24).padStart(2, '0')}h:00m
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#263449]/50">
              <span className="text-slate-400">Evaluation Window:</span>
              <span className="text-slate-300">
                336 Hours (14.0 Earth Days / ~0.5 Lunar Synodic Day)
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#263449]/50">
              <span className="text-slate-400">Solar Diurnal Rate:</span>
              <span className="text-slate-300">~0.508° Azimuth / Hour (360° per 708.7h)</span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed font-sans pt-1">
              Mission planning envelope is benchmarked against Artemis III polar operations, capturing high-latitude solar grazing angles and lunar libration cycles.
            </p>
          </div>
        </Card>
      </div>

      {/* 3. Subsystem Conditions Synthesis (Solar vs Communications) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Solar & Illumination Subsystem Assessment */}
        <Card className="p-4 bg-[#101827] border-[#263449] space-y-3">
          <div className="flex items-center justify-between border-b border-[#263449] pb-2">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-[#FBBF24]" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
                Solar Illumination & Power Subsystem
              </h3>
            </div>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                currentTimelinePoint.isSunlit
                  ? 'bg-amber-500/15 border-amber-500/30 text-[#FBBF24]'
                  : currentTimelinePoint.isSunGeometricVisible
                  ? 'bg-amber-900/20 border-amber-700/30 text-amber-400'
                  : 'bg-slate-800 border-[#263449] text-slate-400'
              }`}
            >
              {currentTimelinePoint.isSunlit
                ? 'DIRECT SUNLIGHT'
                : currentTimelinePoint.isSunGeometricVisible
                ? 'TERRAIN OCCULTATION'
                : 'SUB-HORIZON'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded bg-[#080D18] border border-[#263449] space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">Current Solar Elevation</span>
              <div className="text-lg font-bold text-[#FBBF24]">
                {currentSunPosition.elevation > 0
                  ? `+${currentSunPosition.elevation.toFixed(2)}`
                  : currentSunPosition.elevation.toFixed(2)}°
              </div>
              <span className="text-[10px] text-slate-400">
                Azimuth: {currentSunPosition.azimuth.toFixed(1)}°
              </span>
            </div>

            <div className="p-2.5 rounded bg-[#080D18] border border-[#263449] space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">Cumulative Sunlight</span>
              <div className="text-lg font-bold text-[#38BDF8]">
                {timelineSeries.summary.totalSunlightHours}h{' '}
                <span className="text-xs font-normal">
                  ({timelineSeries.summary.sunlightPercentage}%)
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                Across 336h window
              </span>
            </div>

            <div className="p-2.5 rounded bg-[#080D18] border border-[#263449] space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">Longest Continuous Shadow</span>
              <div className="text-lg font-bold text-amber-400">
                {timelineSeries.summary.longestContinuousDarknessHours} Hours
              </div>
              <span className="text-[10px] text-slate-400">
                Battery sizing benchmark
              </span>
            </div>

            <div className="p-2.5 rounded bg-[#080D18] border border-[#263449] space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">Horizon Crest Angle</span>
              <div className="text-lg font-bold text-slate-200">
                +{currentTimelinePoint.terrainElevationAtSunAz.toFixed(2)}°
              </div>
              <span className="text-[10px] text-slate-400">
                Local ridge obstruction
              </span>
            </div>
          </div>
        </Card>

        {/* Earth & Communications Subsystem Assessment */}
        <Card className="p-4 bg-[#101827] border-[#263449] space-y-3">
          <div className="flex items-center justify-between border-b border-[#263449] pb-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#60A5FA]" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
                Earth Line-of-Sight & Communications
              </h3>
            </div>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                currentTimelinePoint.hasEarthComm
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : currentTimelinePoint.isEarthGeometricVisible
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                  : 'bg-slate-800 border-[#263449] text-slate-400'
              }`}
            >
              {currentTimelinePoint.hasEarthComm
                ? 'DTE LINK ACTIVE'
                : currentTimelinePoint.isEarthGeometricVisible
                ? 'TERRAIN OCCULTED'
                : 'SUB-HORIZON'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded bg-[#080D18] border border-[#263449] space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">Current Earth Elevation</span>
              <div className="text-lg font-bold text-[#60A5FA]">
                {currentEarthPosition.elevation > 0
                  ? `+${currentEarthPosition.elevation.toFixed(2)}`
                  : currentEarthPosition.elevation.toFixed(2)}°
              </div>
              <span className="text-[10px] text-slate-400">
                Azimuth: {currentEarthPosition.azimuth.toFixed(1)}°
              </span>
            </div>

            <div className="p-2.5 rounded bg-[#080D18] border border-[#263449] space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">DTE Comm Coverage</span>
              <div className="text-lg font-bold text-[#34D399]">
                {timelineSeries.summary.totalCommHours}h{' '}
                <span className="text-xs font-normal">
                  ({timelineSeries.summary.commPercentage}%)
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                Direct Earth visibility
              </span>
            </div>

            <div className="p-2.5 rounded bg-[#080D18] border border-[#263449] space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">Libration Elevation Range</span>
              <div className="text-lg font-bold text-slate-200">
                {timelineSeries.summary.minEarthElevation > 0
                  ? `+${timelineSeries.summary.minEarthElevation}`
                  : timelineSeries.summary.minEarthElevation}° to +{timelineSeries.summary.maxEarthElevation}°
              </div>
              <span className="text-[10px] text-slate-400">
                ~27.3-day libration cycle
              </span>
            </div>

            <div className="p-2.5 rounded bg-[#080D18] border border-[#263449] space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">Crest Blocking Elevation</span>
              <div className="text-lg font-bold text-slate-200">
                +{currentTimelinePoint.terrainElevationAtEarthAz.toFixed(2)}°
              </div>
              <span className="text-[10px] text-slate-400">
                Line-of-sight threshold
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* 4. Operational Window Allocation (4 Mutually Exclusive Operational Regimes) */}
      <Card className="p-4 bg-[#101827] border-[#263449] space-y-4">
        <div className="flex items-center justify-between border-b border-[#263449] pb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#38BDF8]" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
              Operational Subsystem Window Allocation
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            Total Window: 336 Hours (100.0%)
          </span>
        </div>

        {/* Visual Multi-Color Allocation Strip */}
        <div className="space-y-1.5">
          <div className="w-full h-4 rounded-md overflow-hidden flex bg-[#080D18] border border-[#263449]">
            <div
              style={{ width: `${windowMetrics.simultaneousPct}%` }}
              title={`Simultaneous High Capability: ${windowMetrics.simultaneousHours}h (${windowMetrics.simultaneousPct}%)`}
              className="bg-emerald-500 hover:bg-emerald-400 transition-all cursor-help"
            />
            <div
              style={{ width: `${windowMetrics.batteryOnlyPct}%` }}
              title={`Battery-Only Comm: ${windowMetrics.batteryOnlyHours}h (${windowMetrics.batteryOnlyPct}%)`}
              className="bg-[#60A5FA] hover:bg-blue-400 transition-all cursor-help"
            />
            <div
              style={{ width: `${windowMetrics.solarOnlyPct}%` }}
              title={`Solar Power Only (Blackout): ${windowMetrics.solarOnlyHours}h (${windowMetrics.solarOnlyPct}%)`}
              className="bg-[#FBBF24] hover:bg-amber-300 transition-all cursor-help"
            />
            <div
              style={{ width: `${windowMetrics.survivalPct}%` }}
              title={`Survival (Darkness & Blackout): ${windowMetrics.survivalHours}h (${windowMetrics.survivalPct}%)`}
              className="bg-slate-700 hover:bg-slate-600 transition-all cursor-help"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
              Simultaneous Sun + DTE ({windowMetrics.simultaneousPct}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-[#60A5FA] inline-block" />
              Battery-Only Comm ({windowMetrics.batteryOnlyPct}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-[#FBBF24] inline-block" />
              Solar-Only Autonomy ({windowMetrics.solarOnlyPct}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-slate-700 inline-block" />
              Survival / Deep Battery ({windowMetrics.survivalPct}%)
            </span>
          </div>
        </div>

        {/* 4 Windows Detailed Descriptions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-lg bg-[#080D18] border border-emerald-500/30 space-y-1">
            <div className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> High-Capability Window
            </div>
            <div className="text-xl font-bold text-slate-100">
              {windowMetrics.simultaneousHours}h{' '}
              <span className="text-xs text-slate-400 font-normal">
                ({windowMetrics.simultaneousPct}%)
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans leading-tight">
              Direct sunlight + Direct-To-Earth line of sight. Optimal for crewed EVAs and high-bandwidth telemetry.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#080D18] border border-blue-500/30 space-y-1">
            <div className="text-[#60A5FA] font-bold flex items-center gap-1">
              <Wifi className="w-3.5 h-3.5" /> Battery-Only Comm
            </div>
            <div className="text-xl font-bold text-slate-100">
              {windowMetrics.batteryOnlyHours}h{' '}
              <span className="text-xs text-slate-400 font-normal">
                ({windowMetrics.batteryOnlyPct}%)
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans leading-tight">
              Terrain shadow with active Earth RF link. Surface operations powered by internal battery storage.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#080D18] border border-amber-500/30 space-y-1">
            <div className="text-[#FBBF24] font-bold flex items-center gap-1">
              <Sun className="w-3.5 h-3.5" /> Solar Power Only
            </div>
            <div className="text-xl font-bold text-slate-100">
              {windowMetrics.solarOnlyHours}h{' '}
              <span className="text-xs text-slate-400 font-normal">
                ({windowMetrics.solarOnlyPct}%)
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans leading-tight">
              Solar illumination active during RF blackout behind ridges. Requires autonomous rover/surface control.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#080D18] border border-[#263449] space-y-1">
            <div className="text-slate-400 font-bold flex items-center gap-1">
              <BatteryCharging className="w-3.5 h-3.5" /> Deep Battery Survival
            </div>
            <div className="text-xl font-bold text-slate-100">
              {windowMetrics.survivalHours}h{' '}
              <span className="text-xs text-slate-400 font-normal">
                ({windowMetrics.survivalPct}%)
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans leading-tight">
              Simultaneous shadow and RF occultation. Spacecraft systems operate in low-power survival sleep state.
            </p>
          </div>
        </div>
      </Card>

      {/* 5. Explicitly Defined Feasibility Index & Sensitivity Weighting */}
      <Card className="p-4 bg-[#101827] border-[#263449] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#263449] pb-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#38BDF8]" />
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
                Transparent Operational Feasibility Index (OFI)
              </h3>
              <p className="text-[10px] font-mono text-slate-400">
                Multi-attribute linear synthesis with user-inspectable weighting parameters
              </p>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-[10px] text-slate-500 uppercase mr-1">Weight Presets:</span>
            <Button
              size="xs"
              variant={activePreset === 'balanced' ? 'primary' : 'secondary'}
              onClick={() => handleApplyPreset('balanced')}
              className="text-[10px]"
            >
              Balanced (40/35/25)
            </Button>
            <Button
              size="xs"
              variant={activePreset === 'solar' ? 'amber' : 'secondary'}
              onClick={() => handleApplyPreset('solar')}
              className="text-[10px]"
            >
              Solar-Priority
            </Button>
            <Button
              size="xs"
              variant={activePreset === 'comm' ? 'primary' : 'secondary'}
              onClick={() => handleApplyPreset('comm')}
              className="text-[10px]"
            >
              Comm-Priority
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => setShowFormulaDetails(!showFormulaDetails)}
              className="text-[10px]"
            >
              <Info className="w-3 h-3" />
              {showFormulaDetails ? 'Hide Formula' : 'Inspect Formula'}
            </Button>
          </div>
        </div>

        {/* Score & Characterization Output */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-4 p-4 rounded-lg bg-[#080D18] border border-[#263449] flex flex-col items-center justify-center text-center space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Computed Feasibility Index
            </span>
            <div className="text-4xl font-mono font-bold text-[#38BDF8]">
              {feasibilityScore.toFixed(1)}
              <span className="text-sm font-normal text-slate-500"> / 100</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${missionCharacterization.badgeBg}`}>
              {missionCharacterization.label}
            </span>
          </div>

          <div className="md:col-span-8 space-y-2">
            <div className="text-xs font-mono font-semibold text-slate-200 uppercase">
              Mission Architecture Characterization:
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {missionCharacterization.description}
            </p>
            <div className="p-2.5 rounded bg-[#080D18] border border-[#263449] text-[11px] font-mono text-slate-400">
              <span className="text-slate-300 font-semibold uppercase">Non-Universal Evaluation Notice: </span>
              LunaScope avoids declaring a universal "pass" or "fail". An architecture with a lower feasibility index can succeed with appropriate countermeasures (such as carrying larger batteries or deploying an orbital relay).
            </div>
          </div>
        </div>

        {/* Expandable Mathematical Formula Transparency Box */}
        {showFormulaDetails && (
          <div className="p-3 rounded-lg bg-[#080D18] border border-[#263449] text-xs font-mono space-y-2">
            <div className="flex items-center gap-1.5 text-slate-300 font-bold uppercase text-[11px]">
              <Sliders className="w-3.5 h-3.5 text-[#38BDF8]" />
              Mathematical Formula Specification
            </div>
            <div className="p-2 bg-[#101827] rounded border border-[#263449] text-[#38BDF8]">
              OFI = (w_sun × P_sun) + (w_comm × P_comm) + (w_sim × P_sim)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-400">
              <div>
                <strong className="text-slate-200">w_sun = {weights.sunlightWeight.toFixed(2)}</strong>: Weight on Cumulative Sunlight ({timelineSeries.summary.sunlightPercentage}%)
              </div>
              <div>
                <strong className="text-slate-200">w_comm = {weights.commWeight.toFixed(2)}</strong>: Weight on DTE Comm Coverage ({timelineSeries.summary.commPercentage}%)
              </div>
              <div>
                <strong className="text-slate-200">w_sim = {weights.simultaneousWeight.toFixed(2)}</strong>: Weight on Simultaneous Capability ({windowMetrics.simultaneousPct}%)
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 6. Missing or Uncertain Information Disclosures */}
      <Card className="p-4 bg-[#080D18] border border-[#263449] space-y-3">
        <div className="flex items-center gap-2 border-b border-[#263449] pb-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
            Uncertainties, Data Limitations & Scientific Disclosures
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-2.5 rounded bg-[#101827] border border-[#263449] space-y-1">
            <span className="text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> Micro-Topography
            </span>
            <p className="text-[10px] text-slate-400 font-sans leading-tight">
              LRO LOLA elevation grids at 20-30m/pixel do not resolve sub-metre boulders, crater rim micro-slopes, or surface roughness.
            </p>
          </div>

          <div className="p-2.5 rounded bg-[#101827] border border-[#263449] space-y-1">
            <span className="text-[#38BDF8] font-semibold flex items-center gap-1 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Coordinate Verification
            </span>
            <p className="text-[10px] text-slate-400 font-sans leading-tight">
              {selectedSite.isVerified
                ? 'Coordinates benchmarked against NASA Artemis III Candidate Zone releases (LRO reference frame).'
                : 'Custom coordinates are user-defined demonstration inputs and have not been validated against LOLA ground control points.'}
            </p>
          </div>

          <div className="p-2.5 rounded bg-[#101827] border border-[#263449] space-y-1">
            <span className="text-[#FBBF24] font-semibold flex items-center gap-1 text-[11px]">
              <Sun className="w-3.5 h-3.5 shrink-0" /> Secondary Scattering
            </span>
            <p className="text-[10px] text-slate-400 font-sans leading-tight">
              Albedo reflections from illuminated opposing crater walls and regolith thermal re-radiation are not incorporated into purely geometric line-of-sight raycasts.
            </p>
          </div>

          <div className="p-2.5 rounded bg-[#101827] border border-[#263449] space-y-1">
            <span className="text-[#60A5FA] font-semibold flex items-center gap-1 text-[11px]">
              <Radio className="w-3.5 h-3.5 shrink-0" /> Ephemeris Model Fidelity
            </span>
            <p className="text-[10px] text-slate-400 font-sans leading-tight">
              Solar and Earth positions use simplified demonstration orbital mechanics. Operational flight certification requires full numerical NASA JPL SPICE kernels.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default MissionSummary;
