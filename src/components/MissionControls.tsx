import React from 'react';
import {
  Compass,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Clock,
} from 'lucide-react';
import { useMission } from '../context/MissionContext';
import { SiteSelector } from './SiteSelector';
import { DateSelector } from './DateSelector';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';

export const MissionControls: React.FC = () => {
  const {
    selectedSite,
    missionDate,
    missionTime,
    selectedTimestampUtc,
    validation,
  } = useMission();

  return (
    <div className="space-y-6">
      {/* 1. Mission Context Summary Telemetry HUD Bar */}
      <Card className="bg-[#101827] border-[#263449]">
        <div className="p-4 flex flex-wrap items-center justify-between gap-4">
          {/* Target Region Overview */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[#152033] border border-[#263449] flex items-center justify-center text-[#38BDF8] shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-100 uppercase tracking-wide">
                  {selectedSite.name}
                </span>
                <Badge
                  variant={selectedSite.isVerified ? 'success' : 'warning'}
                  hasDot
                >
                  {selectedSite.isVerified ? 'NASA Verified' : 'Approx Demo'}
                </Badge>
              </div>
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#38BDF8]" />
                  {Math.abs(selectedSite.latitude).toFixed(2)}°S,{' '}
                  {selectedSite.longitude.toFixed(2)}°E
                </span>
                {selectedSite.elevation_m !== undefined && (
                  <span className="text-slate-500">
                    Elev: +{selectedSite.elevation_m}m
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Temporal Epoch Overview */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[#152033] border border-[#263449] flex items-center justify-center text-[#FBBF24] shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-slate-100 uppercase tracking-wide">
                {missionDate} @ {missionTime} UTC
              </div>
              <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3 text-[#FBBF24]" />
                <span className="tabular-nums text-slate-300">
                  {selectedTimestampUtc}
                </span>
              </div>
            </div>
          </div>

          {/* Validation Status Pill */}
          <div className="flex items-center gap-2">
            {validation.isValid ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#34D399]/10 border border-[#34D399]/30 text-[#34D399] font-mono text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>PARAMETERS VALIDATED</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#F87171]/10 border border-[#F87171]/30 text-[#F87171] font-mono text-xs font-semibold">
                <AlertTriangle className="w-4 h-4" />
                <span>VALIDATION ALERT</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 2. Interactive Selection Controls Grid (SiteSelector & DateSelector) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SiteSelector />
        <DateSelector />
      </div>

      {/* 3. Validation & Operational Advisories */}
      {validation.warnings.length > 0 && (
        <div className="p-3 rounded bg-[#FBBF24]/10 border border-[#FBBF24]/30 text-[#FBBF24] text-xs font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {validation.warnings.join(' ')}
          </span>
        </div>
      )}
    </div>
  );
};
