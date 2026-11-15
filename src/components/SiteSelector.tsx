import React, { useState } from 'react';
import {
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sliders,
  RotateCcw,
} from 'lucide-react';
import { useMission } from '../context/MissionContext';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

export const SiteSelector: React.FC = () => {
  const {
    selectedSite,
    allSites,
    isCustomSite,
    validation,
    selectSiteById,
    setCustomSiteCoordinates,
    resetToPreset,
  } = useMission();

  const [isCustomMode, setIsCustomMode] = useState<boolean>(isCustomSite);
  const [customLatInput, setCustomLatInput] = useState<string>(
    selectedSite.latitude.toString()
  );
  const [customLonInput, setCustomLonInput] = useState<string>(
    selectedSite.longitude.toString()
  );
  const [customInputError, setCustomInputError] = useState<string | null>(null);

  const handleSelectPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const siteId = e.target.value;
    if (siteId === 'custom') {
      setIsCustomMode(true);
      return;
    }
    setIsCustomMode(false);
    setCustomInputError(null);
    selectSiteById(siteId);
    const chosen = allSites.find((s) => s.id === siteId);
    if (chosen) {
      setCustomLatInput(chosen.latitude.toString());
      setCustomLonInput(chosen.longitude.toString());
    }
  };

  const handleApplyCustomCoordinates = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomInputError(null);

    const lat = parseFloat(customLatInput);
    const lon = parseFloat(customLonInput);

    if (isNaN(lat)) {
      setCustomInputError('Latitude must be a valid number.');
      return;
    }

    if (isNaN(lon)) {
      setCustomInputError('Longitude must be a valid number.');
      return;
    }

    if (lat < -90.0 || lat > -80.0) {
      setCustomInputError(
        'South polar latitude must be between -90.00° and -80.00°S.'
      );
      return;
    }

    if (lon < 0.0 || lon > 360.0) {
      setCustomInputError('Longitude must be between 0.00° and 360.00° East.');
      return;
    }

    const success = setCustomSiteCoordinates(lat, lon);
    if (!success) {
      setCustomInputError('Failed to apply custom coordinates.');
    }
  };

  const handleReset = () => {
    setIsCustomMode(false);
    setCustomInputError(null);
    resetToPreset();
    const def = allSites[0];
    setCustomLatInput(def.latitude.toString());
    setCustomLonInput(def.longitude.toString());
  };

  return (
    <Card className="h-full flex flex-col justify-between">
      <div>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#38BDF8]" />
            <CardTitle>Target Site Selection</CardTitle>
          </div>
          <Badge
            variant={selectedSite.isVerified ? 'success' : 'warning'}
            hasDot
          >
            {selectedSite.isVerified ? 'Verified Region' : 'Approximate Demo'}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Preset Dropdown Selector */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="site-selector-dropdown"
              className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-medium"
            >
              Candidate Landing Region
            </label>
            <select
              id="site-selector-dropdown"
              value={isCustomSite ? 'custom' : selectedSite.id}
              onChange={handleSelectPreset}
              className="w-full rounded border border-[#263449] bg-[#080D18] px-3 py-1.5 text-xs font-mono text-slate-100 transition-colors focus:border-[#38BDF8] focus:outline-none focus:ring-1 focus:ring-[#38BDF8]"
            >
              {allSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} ({Math.abs(site.latitude).toFixed(2)}°S, {site.longitude.toFixed(2)}°E)
                </option>
              ))}
              <option value="custom">-- Custom Polar Coordinates --</option>
            </select>
          </div>

          {/* Quick Selection Cards Grid */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {allSites.map((site) => {
              const isSelected = !isCustomSite && selectedSite.id === site.id;
              return (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => {
                    setIsCustomMode(false);
                    setCustomInputError(null);
                    selectSiteById(site.id);
                    setCustomLatInput(site.latitude.toString());
                    setCustomLonInput(site.longitude.toString());
                  }}
                  className={`text-left p-2.5 rounded border transition-colors ${
                    isSelected
                      ? 'bg-[#152033] border-[#38BDF8] text-white'
                      : 'bg-[#080D18] border-[#263449] text-slate-300 hover:border-slate-500 hover:bg-[#101827]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-mono font-semibold truncate mb-1">
                    <span className="truncate">{site.name}</span>
                    {isSelected && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {Math.abs(site.latitude).toFixed(2)}°S, {site.longitude.toFixed(2)}°E
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Site Readout Panel */}
          <div className="p-3 rounded bg-[#080D18] border border-[#263449] space-y-2">
            <div className="flex items-center justify-between border-b border-[#263449]/70 pb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                Active Site
              </span>
              <span className="text-xs font-mono font-bold text-slate-100">
                {selectedSite.name}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase">Latitude</span>
                <span className="font-semibold text-[#38BDF8]">
                  {Math.abs(selectedSite.latitude).toFixed(2)}°S
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase">Longitude</span>
                <span className="font-semibold text-[#38BDF8]">
                  {selectedSite.longitude.toFixed(2)}°E
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 font-sans leading-relaxed pt-1 border-t border-[#263449]/50">
              {selectedSite.description}
            </p>

            <div className="flex items-center gap-1.5 pt-1 text-[10px] font-mono text-slate-500">
              <Info className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">Source: {selectedSite.coordinateSource}</span>
            </div>
          </div>

          {/* Custom Coordinate Input Section Toggle */}
          {isCustomMode && (
            <form
              onSubmit={handleApplyCustomCoordinates}
              className="p-3 rounded bg-[#152033] border border-[#263449] space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-slate-200 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#FBBF24]" />
                  Enter Custom Coordinates
                </span>
                <span className="text-[10px] font-mono text-[#FBBF24]">
                  Demo Mode
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Latitude (°S)"
                  type="number"
                  step="0.01"
                  min="-90"
                  max="-80"
                  value={customLatInput}
                  onChange={(e) => setCustomLatInput(e.target.value)}
                  suffixElement="°S"
                  placeholder="-89.90"
                />

                <Input
                  label="Longitude (°E)"
                  type="number"
                  step="0.01"
                  min="0"
                  max="360"
                  value={customLonInput}
                  onChange={(e) => setCustomLonInput(e.target.value)}
                  suffixElement="°E"
                  placeholder="0.00"
                />
              </div>

              {customInputError && (
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#F87171] bg-[#F87171]/10 p-2 rounded border border-[#F87171]/20">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{customInputError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={handleReset}
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </Button>
                <Button type="submit" size="xs" variant="primary">
                  Apply Coordinates
                </Button>
              </div>
            </form>
          )}

          {/* Validation Warnings */}
          {validation.errors.latitude && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#F87171] bg-[#F87171]/10 p-2 rounded border border-[#F87171]/30">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{validation.errors.latitude}</span>
            </div>
          )}
        </CardContent>
      </div>

      <div className="px-4 py-2.5 border-t border-[#263449] bg-[#080D18]/40 flex items-center justify-between text-[11px] font-mono text-slate-500">
        <span>Coordinate Datum: LRO LOLA</span>
        {!isCustomMode && (
          <button
            type="button"
            onClick={() => setIsCustomMode(true)}
            className="text-[#38BDF8] hover:underline"
          >
            Custom Input
          </button>
        )}
      </div>
    </Card>
  );
};
