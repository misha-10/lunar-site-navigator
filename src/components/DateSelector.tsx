import React from 'react';
import {
  Calendar,
  Clock,
  Globe2,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useMission } from '../context/MissionContext';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';

export const DateSelector: React.FC = () => {
  const {
    missionDate,
    missionTime,
    selectedTimestampUtc,
    validation,
    setMissionDate,
    setMissionTime,
  } = useMission();

  // Quick Mission Epoch Presets
  const handleSetPreset = (presetDate: string, presetTime: string) => {
    setMissionDate(presetDate);
    setMissionTime(presetTime);
  };

  const handleSetNow = () => {
    const now = new Date();
    const dStr = now.toISOString().slice(0, 10);
    const tStr = now.toISOString().slice(11, 16);
    setMissionDate(dStr);
    setMissionTime(tStr);
  };

  return (
    <Card className="h-full flex flex-col justify-between">
      <div>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#FBBF24]" />
            <CardTitle>Mission Temporal Epoch</CardTitle>
          </div>
          <Badge variant="amber" hasDot>
            UTC Ground Time
          </Badge>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Date & Time Input Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Calendar Date Input */}
            <div className="flex flex-col gap-1">
              <Input
                label="Mission Date (UTC)"
                type="date"
                value={missionDate}
                onChange={(e) => setMissionDate(e.target.value)}
                isMonospace
              />
              {validation.errors.date && (
                <span className="text-[10px] font-mono text-[#F87171]">
                  {validation.errors.date}
                </span>
              )}
            </div>

            {/* Time of Day Input */}
            <div className="flex flex-col gap-1">
              <Input
                label="Mission Time (24h UTC)"
                type="time"
                value={missionTime}
                onChange={(e) => setMissionTime(e.target.value)}
                isMonospace
              />
              {validation.errors.time && (
                <span className="text-[10px] font-mono text-[#F87171]">
                  {validation.errors.time}
                </span>
              )}
            </div>
          </div>

          {/* Quick Epoch Preset Buttons */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              Reference Mission Epochs
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSetPreset('2026-10-15', '12:00')}
                className="p-2 rounded bg-[#080D18] hover:bg-[#152033] border border-[#263449] hover:border-[#38BDF8]/50 text-left transition-colors"
              >
                <div className="text-[11px] font-mono font-semibold text-slate-200 truncate">
                  Artemis III
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  Oct 15, 2026
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSetPreset('2026-12-08', '06:00')}
                className="p-2 rounded bg-[#080D18] hover:bg-[#152033] border border-[#263449] hover:border-[#38BDF8]/50 text-left transition-colors"
              >
                <div className="text-[11px] font-mono font-semibold text-slate-200 truncate">
                  Peak Solstice
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  Dec 08, 2026
                </div>
              </button>

              <button
                type="button"
                onClick={handleSetNow}
                className="p-2 rounded bg-[#080D18] hover:bg-[#152033] border border-[#263449] hover:border-[#38BDF8]/50 text-left transition-colors"
              >
                <div className="text-[11px] font-mono font-semibold text-slate-200 truncate">
                  Current UTC
                </div>
                <div className="text-[10px] font-mono text-[#38BDF8]">
                  Real-time
                </div>
              </button>
            </div>
          </div>

          {/* Selected Timestamp Readout Card */}
          <div className="p-3.5 rounded bg-[#080D18] border border-[#263449] space-y-2">
            <div className="flex items-center justify-between border-b border-[#263449]/70 pb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-[#38BDF8]" />
                Selected Mission Timestamp (ISO 8601)
              </span>
              <span className="text-[10px] font-mono text-[#34D399] font-medium">
                SYNCHRONIZED
              </span>
            </div>

            <div className="space-y-1">
              <div className="font-mono text-sm font-bold text-slate-100 tracking-wider">
                {selectedTimestampUtc}
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                <Clock className="w-3 h-3 text-[#FBBF24]" />
                <span>
                  Date: <strong className="text-slate-200">{missionDate}</strong> | Time:{' '}
                  <strong className="text-slate-200">{missionTime} UTC</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Validation Status */}
          {(!validation.isValid && (validation.errors.date || validation.errors.time)) && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#F87171] bg-[#F87171]/10 p-2 rounded border border-[#F87171]/30">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                {validation.errors.date || validation.errors.time}
              </span>
            </div>
          )}
        </CardContent>
      </div>

      <div className="px-4 py-2.5 border-t border-[#263449] bg-[#080D18]/40 flex items-center justify-between text-[11px] font-mono text-slate-500">
        <span>Time Standard: Universal Coordinated Time (UTC)</span>
        <span className="text-[#38BDF8] flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Ephemeris Sync
        </span>
      </div>
    </Card>
  );
};
