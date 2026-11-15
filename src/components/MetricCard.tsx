import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Card } from './ui/Card';

export type MetricStatus = 'nominal' | 'warning' | 'caution' | 'neutral' | 'active';
export type MetricAccent = 'cyan' | 'amber' | 'blue' | 'success' | 'warning';

export interface MetricCardProps {
  /** Clear title for the metric */
  title: string;
  /** Primary metric value (number or pre-formatted string) */
  value?: number | string | null;
  /** Physical or engineering unit (e.g. "°", "hours", "dB") */
  unit?: string;
  /** Contextual or descriptive subtitle */
  subtitle?: string;
  /** Status category for color-coding the indicator */
  status?: MetricStatus;
  /** Short status text or label */
  statusText?: string;
  /** Accent color scheme */
  accentColor?: MetricAccent;
  /** Icon component to display in the header */
  icon?: React.ComponentType<{ className?: string }>;
  /** Whether the metric is currently loading */
  isLoading?: boolean;
  /** Whether data is missing/unavailable */
  isMissingData?: boolean;
  /** Explicit demo data indicator label */
  isDemoData?: boolean;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  status = 'nominal',
  statusText,
  accentColor = 'cyan',
  icon: Icon,
  isLoading = false,
  isMissingData = false,
  isDemoData = true,
  className = '',
}) => {
  // Border and accent styling
  const accentBorderMap: Record<MetricAccent, string> = {
    cyan: 'border-[#263449] hover:border-[#38BDF8]/50',
    amber: 'border-[#263449] hover:border-[#FBBF24]/50',
    blue: 'border-[#263449] hover:border-[#60A5FA]/50',
    success: 'border-[#263449] hover:border-[#34D399]/50',
    warning: 'border-[#263449] hover:border-[#F87171]/50',
  };

  const accentTextMap: Record<MetricAccent, string> = {
    cyan: 'text-[#38BDF8]',
    amber: 'text-[#FBBF24]',
    blue: 'text-[#60A5FA]',
    success: 'text-[#34D399]',
    warning: 'text-[#F87171]',
  };

  const accentBgMap: Record<MetricAccent, string> = {
    cyan: 'bg-[#38BDF8]/10 text-[#38BDF8]',
    amber: 'bg-[#FBBF24]/10 text-[#FBBF24]',
    blue: 'bg-[#60A5FA]/10 text-[#60A5FA]',
    success: 'bg-[#34D399]/10 text-[#34D399]',
    warning: 'bg-[#F87171]/10 text-[#F87171]',
  };

  const statusIndicatorMap: Record<MetricStatus, { bg: string; dot: string; text: string }> = {
    nominal: { bg: 'bg-[#34D399]/10 border-[#34D399]/30 text-[#34D399]', dot: 'bg-[#34D399]', text: 'text-[#34D399]' },
    active: { bg: 'bg-[#38BDF8]/10 border-[#38BDF8]/30 text-[#38BDF8]', dot: 'bg-[#38BDF8]', text: 'text-[#38BDF8]' },
    caution: { bg: 'bg-[#FBBF24]/10 border-[#FBBF24]/30 text-[#FBBF24]', dot: 'bg-[#FBBF24]', text: 'text-[#FBBF24]' },
    warning: { bg: 'bg-[#F87171]/10 border-[#F87171]/30 text-[#F87171]', dot: 'bg-[#F87171]', text: 'text-[#F87171]' },
    neutral: { bg: 'bg-[#152033] border-[#263449] text-slate-400', dot: 'bg-slate-400', text: 'text-slate-400' },
  };

  const currentStatus = statusIndicatorMap[status];

  // 1. Loading State
  if (isLoading) {
    return (
      <Card className={`p-4 bg-[#101827] border-[#263449] animate-pulse flex flex-col justify-between h-36 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="h-3 w-28 bg-[#1C273A] rounded" />
          <div className="h-4 w-12 bg-[#1C273A] rounded" />
        </div>
        <div className="space-y-2 my-auto">
          <div className="h-8 w-32 bg-[#1C273A] rounded" />
          <div className="h-2.5 w-44 bg-[#1C273A] rounded" />
        </div>
        <div className="h-3 w-20 bg-[#1C273A] rounded" />
      </Card>
    );
  }

  // 2. Missing Data State (Strict guard against null, undefined, NaN, and Infinity)
  const hasNoData =
    isMissingData ||
    value === null ||
    value === undefined ||
    (typeof value === 'number' && (!isFinite(value) || isNaN(value)));

  return (
    <Card
      className={`p-4 bg-[#101827] transition-all flex flex-col justify-between h-full ${accentBorderMap[accentColor]} ${className}`}
    >
      {/* Top Header: Title & Badges */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {Icon && (
              <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${accentBgMap[accentColor]}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            )}
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200 truncate" title={title}>
              {title}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isDemoData ? (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-300/80 border border-amber-500/25">
                DEMO
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-bold">
                LIVE SPICE
              </span>
            )}
          </div>
        </div>

        {/* Primary Metric Readout */}
        <div className="my-2">
          {hasNoData ? (
            <div className="flex items-center gap-2 py-1">
              <span className="text-xl font-mono font-bold text-slate-500 tracking-wider">
                --
              </span>
              <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-slate-500" /> UNAVAILABLE
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className={`text-2xl font-mono font-bold tracking-tight ${accentTextMap[accentColor]}`}>
                {typeof value === 'number' && value > 0 && title.toLowerCase().includes('elevation')
                  ? `+${value.toFixed(2)}`
                  : typeof value === 'number'
                  ? value.toFixed(1)
                  : value}
              </span>
              {unit && (
                <span className="text-xs font-mono text-slate-400 font-medium">
                  {unit}
                </span>
              )}
            </div>
          )}

          {/* Subtitle / Context */}
          {subtitle && (
            <p className="text-[10px] font-mono text-slate-400 mt-1 truncate" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Bottom Status Indicator Bar */}
      <div className="pt-2 border-t border-[#263449]/70 flex items-center justify-between text-[10px] font-mono">
        <span className="text-slate-500 uppercase">STATUS</span>
        {statusText ? (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border ${currentStatus.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${currentStatus.dot}`} />
            <span className="font-semibold uppercase">{statusText}</span>
          </span>
        ) : (
          <span className="text-slate-500">--</span>
        )}
      </div>
    </Card>
  );
};

export default MetricCard;
