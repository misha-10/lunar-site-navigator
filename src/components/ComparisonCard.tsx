import React from 'react';
import {
  Sun,
  Radio,
  Clock,
  Compass,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import type { LunarSite } from '../types/mission';
import type { ComparisonScenario, MetricComparisonItem } from '../types/comparison';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

export interface ComparisonCardProps {
  scenario: ComparisonScenario;
  baselineScenario?: ComparisonScenario;
  allSites: LunarSite[];
  onUpdateSite: (siteId: string) => void;
  onUpdateDate: (date: string) => void;
  onUpdateTime: (time: string) => void;
  onRemove?: () => void;
  canRemove: boolean;
  onSyncActive?: () => void;
  onToggleMissing?: () => void;
  metricComparison: MetricComparisonItem[];
  isBaseline: boolean;
  className?: string;
}

export const ComparisonCard: React.FC<ComparisonCardProps> = ({
  scenario,
  baselineScenario,
  allSites,
  onUpdateSite,
  onUpdateDate,
  onUpdateTime,
  onRemove,
  canRemove,
  onSyncActive,
  onToggleMissing,
  metricComparison,
  isBaseline,
  className = '',
}) => {
  const { site, date, time, metrics, isSimulatedMissing } = scenario;

  // Helper to check if this scenario leads an individual metric
  const isLeadingMetric = (key: string) => {
    const comp = metricComparison.find((m) => m.key === key);
    return comp && comp.leadingScenarioId === scenario.id;
  };

  // Helper to compute numeric delta vs baseline scenario
  const getDeltaDisplay = (currentVal: number | null, baselineVal: number | null, unit: string) => {
    if (
      isBaseline ||
      currentVal === null ||
      baselineVal === null ||
      Number.isNaN(currentVal) ||
      Number.isNaN(baselineVal)
    )
      return null;
    const diff = currentVal - baselineVal;
    if (Math.abs(diff) < 0.01) {
      return (
        <span className="text-[10px] font-mono text-slate-500 flex items-center gap-0.5">
          <Minus className="w-3 h-3" /> No delta vs {baselineScenario?.label}
        </span>
      );
    }
    const isPositive = diff > 0;
    return (
      <span
        className={`text-[10px] font-mono flex items-center gap-0.5 ${
          isPositive ? 'text-emerald-400' : 'text-slate-400'
        }`}
      >
        {isPositive ? (
          <ArrowUpRight className="w-3 h-3 text-emerald-400" />
        ) : (
          <ArrowDownRight className="w-3 h-3 text-slate-400" />
        )}
        <span>
          {isPositive ? '+' : ''}
          {diff.toFixed(1)}
          {unit} vs {baselineScenario?.label}
        </span>
      </span>
    );
  };

  return (
    <Card className={`p-4 bg-[#101827] border-[#263449] flex flex-col justify-between space-y-4 ${className}`}>
      {/* 1. Header: Scenario Identifier & Controls */}
      <div>
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#263449]">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider ${
                scenario.label.includes('A')
                  ? 'bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30'
                  : scenario.label.includes('B')
                  ? 'bg-[#FBBF24]/15 text-[#FBBF24] border border-[#FBBF24]/30'
                  : 'bg-[#60A5FA]/15 text-[#60A5FA] border border-[#60A5FA]/30'
              }`}
            >
              {scenario.label}
            </span>
            {isBaseline && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-400 border border-[#263449]">
                BASELINE
              </span>
            )}
            {scenario.isDemoData ? (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-300/80 border border-amber-500/25">
                DEMO
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30 font-bold">
                LIVE SPICE
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {onSyncActive && (
              <Button
                size="xs"
                variant="secondary"
                onClick={onSyncActive}
                title="Sync site, date, and time from active planner"
                className="text-[10px] py-0.5 px-2"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Sync Active</span>
              </Button>
            )}

            {canRemove && onRemove && (
              <Button
                size="xs"
                variant="secondary"
                onClick={onRemove}
                title="Remove scenario from comparison"
                className="text-slate-400 hover:text-rose-400 py-0.5 px-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* 2. Scenario Inputs: Site, Date, Time */}
        <div className="mt-3 space-y-2.5 p-2.5 rounded bg-[#080D18] border border-[#263449] text-xs font-mono">
          {/* Site Selector Dropdown */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <Compass className="w-3 h-3 text-[#38BDF8]" />
                LANDING TARGET SITE:
              </span>
              <span className="text-[9px] text-slate-500">
                {Math.abs(site.latitude).toFixed(2)}°S, {site.longitude.toFixed(2)}°E
              </span>
            </div>
            <select
              value={site.id}
              onChange={(e) => onUpdateSite(e.target.value)}
              className="w-full bg-[#101827] border border-[#263449] rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#38BDF8]"
            >
              {allSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time Inputs */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#263449]/60">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 text-[#38BDF8]" />
                DATE (UTC):
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => onUpdateDate(e.target.value)}
                className="w-full bg-[#101827] border border-[#263449] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#38BDF8]"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 text-[#38BDF8]" />
                TIME (UTC):
              </span>
              <input
                type="time"
                value={time}
                onChange={(e) => onUpdateTime(e.target.value)}
                className="w-full bg-[#101827] border border-[#263449] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#38BDF8]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. The 4 Comparative Mission Metrics */}
      <div className="space-y-2.5">
        {/* Metric 1: Solar Elevation */}
        <div
          className={`p-3 rounded-lg border transition-all ${
            isLeadingMetric('solarElevation')
              ? 'bg-[#152033] border-amber-500/50 shadow-sm'
              : 'bg-[#080D18] border-[#263449]'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-[#FBBF24]" />
              Solar Elevation at Landing
            </span>
            {isLeadingMetric('solarElevation') && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/20 text-[#FBBF24] border border-amber-500/40 flex items-center gap-1 font-bold">
                <Award className="w-3 h-3" /> OPTIMAL
              </span>
            )}
          </div>

          {metrics.solarElevation === null || Number.isNaN(metrics.solarElevation) ? (
            <div className="flex items-center gap-1.5 py-0.5 text-xs font-mono text-slate-500">
              <AlertTriangle className="w-3 h-3 text-amber-500/70" />
              <span>DATA UNAVAILABLE</span>
            </div>
          ) : (
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-mono font-bold text-[#FBBF24]">
                {metrics.solarElevation > 0 ? `+${metrics.solarElevation.toFixed(2)}` : metrics.solarElevation.toFixed(2)}°
              </span>
              {getDeltaDisplay(metrics.solarElevation, baselineScenario?.metrics.solarElevation ?? null, '°')}
            </div>
          )}
        </div>

        {/* Metric 2: Sunlight Duration */}
        <div
          className={`p-3 rounded-lg border transition-all ${
            isLeadingMetric('sunlightDurationHours')
              ? 'bg-[#152033] border-[#38BDF8]/50 shadow-sm'
              : 'bg-[#080D18] border-[#263449]'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-[#38BDF8]" />
              Cumulative Sunlight Duration
            </span>
            {isLeadingMetric('sunlightDurationHours') && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40 flex items-center gap-1 font-bold">
                <Award className="w-3 h-3" /> OPTIMAL
              </span>
            )}
          </div>

          {metrics.sunlightDurationHours === null || Number.isNaN(metrics.sunlightDurationHours) ? (
            <div className="flex items-center gap-1.5 py-0.5 text-xs font-mono text-slate-500">
              <AlertTriangle className="w-3 h-3 text-amber-500/70" />
              <span>DATA UNAVAILABLE</span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-mono font-bold text-[#38BDF8]">
                  {metrics.sunlightDurationHours.toFixed(1)}h{' '}
                  <span className="text-xs text-slate-400 font-normal">
                    ({metrics.sunlightPercentage?.toFixed(1)}%)
                  </span>
                </span>
                {getDeltaDisplay(
                  metrics.sunlightDurationHours,
                  baselineScenario?.metrics.sunlightDurationHours ?? null,
                  'h'
                )}
              </div>
              {metrics.totalSampledSunlightHours !== undefined &&
                metrics.totalSampledSunlightHours !== null && (
                  <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between pt-0.5 border-t border-[#263449]/40">
                    <span>Sampled: {metrics.totalSampledSunlightHours.toFixed(1)}h</span>
                    <span>Interpolated: {metrics.interpolatedSunlightHours?.toFixed(1) ?? metrics.sunlightDurationHours.toFixed(1)}h</span>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Metric 3: Earth Elevation */}
        <div
          className={`p-3 rounded-lg border transition-all ${
            isLeadingMetric('earthElevation')
              ? 'bg-[#152033] border-blue-500/50 shadow-sm'
              : 'bg-[#080D18] border-[#263449]'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[#60A5FA]" />
              Earth Elevation at Landing
            </span>
            {isLeadingMetric('earthElevation') && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-500/20 text-[#60A5FA] border border-blue-500/40 flex items-center gap-1 font-bold">
                <Award className="w-3 h-3" /> OPTIMAL
              </span>
            )}
          </div>

          {metrics.earthElevation === null || Number.isNaN(metrics.earthElevation) ? (
            <div className="flex items-center gap-1.5 py-0.5 text-xs font-mono text-slate-500">
              <AlertTriangle className="w-3 h-3 text-amber-500/70" />
              <span>DATA UNAVAILABLE</span>
            </div>
          ) : (
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-mono font-bold text-[#60A5FA]">
                {metrics.earthElevation > 0 ? `+${metrics.earthElevation.toFixed(2)}` : metrics.earthElevation.toFixed(2)}°
              </span>
              {getDeltaDisplay(metrics.earthElevation, baselineScenario?.metrics.earthElevation ?? null, '°')}
            </div>
          )}
        </div>

        {/* Metric 4: Communication Visibility Duration */}
        <div
          className={`p-3 rounded-lg border transition-all ${
            isLeadingMetric('commVisibilityDurationHours')
              ? 'bg-[#152033] border-emerald-500/50 shadow-sm'
              : 'bg-[#080D18] border-[#263449]'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[#34D399]" />
              Direct-to-Earth Comm Duration
            </span>
            {isLeadingMetric('commVisibilityDurationHours') && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/20 text-[#34D399] border border-emerald-500/40 flex items-center gap-1 font-bold">
                <Award className="w-3 h-3" /> OPTIMAL
              </span>
            )}
          </div>

          {metrics.commVisibilityDurationHours === null || Number.isNaN(metrics.commVisibilityDurationHours) ? (
            <div className="flex items-center gap-1.5 py-0.5 text-xs font-mono text-slate-500">
              <AlertTriangle className="w-3 h-3 text-amber-500/70" />
              <span>DATA UNAVAILABLE</span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-mono font-bold text-[#34D399]">
                  {metrics.commVisibilityDurationHours.toFixed(1)}h{' '}
                  <span className="text-xs text-slate-400 font-normal">
                    ({metrics.commPercentage?.toFixed(1)}%)
                  </span>
                </span>
                {getDeltaDisplay(
                  metrics.commVisibilityDurationHours,
                  baselineScenario?.metrics.commVisibilityDurationHours ?? null,
                  'h'
                )}
              </div>
              {metrics.totalSampledCommHours !== undefined &&
                metrics.totalSampledCommHours !== null && (
                  <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between pt-0.5 border-t border-[#263449]/40">
                    <span>Sampled: {metrics.totalSampledCommHours.toFixed(1)}h</span>
                    <span>Interpolated: {metrics.interpolatedCommHours?.toFixed(1) ?? metrics.commVisibilityDurationHours.toFixed(1)}h</span>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Missing Data Simulation Toggle Footer */}
      {onToggleMissing && (
        <div className="pt-2 border-t border-[#263449]/70 flex items-center justify-between text-[10px] font-mono">
          <span className="text-slate-500">TELEMETRY INTEGRITY</span>
          <button
            type="button"
            onClick={onToggleMissing}
            className={`px-2 py-0.5 rounded border transition ${
              isSimulatedMissing
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-bold'
                : 'bg-[#080D18] border-[#263449] text-slate-400 hover:text-white'
            }`}
          >
            {isSimulatedMissing ? 'Missing Simulated' : 'Simulate Missing'}
          </button>
        </div>
      )}
    </Card>
  );
};

export default ComparisonCard;
