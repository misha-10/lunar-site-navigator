import React, { useState, useEffect } from 'react';
import { Sliders, RotateCcw } from 'lucide-react';
import { useMission } from '../context/MissionContext';
import { DEMONSTRATION_CELESTIAL_DATA } from '../data/demonstrationCelestial';
import type { CelestialPosition } from '../types/mission';
import { HorizonView } from './HorizonView';
import { Button } from './ui/Button';

export const HorizonSection: React.FC = () => {
  const { selectedSite, currentSunPosition, currentEarthPosition } = useMission();

  // Retrieve baseline demonstration ephemeris for the selected candidate site
  const baseData =
    DEMONSTRATION_CELESTIAL_DATA[selectedSite.id] ||
    DEMONSTRATION_CELESTIAL_DATA['shackleton-crater'];

  // Optional local manual override for elevation range testing toolbar
  const [overrideSunEl, setOverrideSunEl] = useState<number | null>(null);
  const [overrideEarthEl, setOverrideEarthEl] = useState<number | null>(null);

  // Active Sun & Earth positions (timeline synchronized with fallback to manual test overrides)
  const activeSunPos: CelestialPosition = React.useMemo(() => {
    if (overrideSunEl !== null) {
      return { ...currentSunPosition, elevation: overrideSunEl };
    }
    return currentSunPosition;
  }, [currentSunPosition, overrideSunEl]);

  const activeEarthPos: CelestialPosition = React.useMemo(() => {
    if (overrideEarthEl !== null) {
      return { ...currentEarthPosition, elevation: overrideEarthEl };
    }
    return currentEarthPosition;
  }, [currentEarthPosition, overrideEarthEl]);

  // Reset override when candidate site changes
  useEffect(() => {
    setOverrideSunEl(null);
    setOverrideEarthEl(null);
  }, [selectedSite.id]);

  const handleAdjustElevation = (target: 'sun' | 'earth', newEl: number) => {
    if (target === 'sun') {
      setOverrideSunEl(newEl);
    } else {
      setOverrideEarthEl(newEl);
    }
  };

  const handleResetToBaseline = () => {
    setOverrideSunEl(null);
    setOverrideEarthEl(null);
  };

  const isOverridden = overrideSunEl !== null || overrideEarthEl !== null;

  return (
    <div className="space-y-3">
      {/* Horizon Visualization Viewport */}
      <HorizonView
        sunPosition={activeSunPos}
        earthPosition={activeEarthPos}
        terrainProfile={baseData.terrainProfile}
        siteName={selectedSite.name}
        isDemoData={activeSunPos.isDemoData ?? true}
      />

      {/* Interactive Verification Toolbar: Elevation Testing */}
      <div className="p-3 rounded-lg bg-[#101827] border border-[#263449] flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#38BDF8]" />
          <span className="text-slate-300 font-semibold uppercase">
            Elevation Range Verification Controls:
          </span>
          <span className="text-slate-500 hidden sm:inline">
            (Test positive vs negative elevation rendering)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Quick Sun Elevation Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Sun Elevation:</span>
            <button
              type="button"
              onClick={() => handleAdjustElevation('sun', -2.5)}
              className={`px-2 py-0.5 rounded border text-[11px] transition ${
                activeSunPos.elevation < 0
                  ? 'bg-amber-500/20 text-[#FBBF24] border-[#FBBF24]/50 font-bold'
                  : 'bg-[#080D18] text-slate-400 border-[#263449] hover:text-white'
              }`}
            >
              -2.5° (Sub-Horizon)
            </button>
            <button
              type="button"
              onClick={() => handleAdjustElevation('sun', 2.8)}
              className={`px-2 py-0.5 rounded border text-[11px] transition ${
                activeSunPos.elevation > 0
                  ? 'bg-amber-500/20 text-[#FBBF24] border-[#FBBF24]/50 font-bold'
                  : 'bg-[#080D18] text-slate-400 border-[#263449] hover:text-white'
              }`}
            >
              +2.8° (Sunlit)
            </button>
          </div>

          {/* Quick Earth Elevation Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Earth Elevation:</span>
            <button
              type="button"
              onClick={() => handleAdjustElevation('earth', -1.5)}
              className={`px-2 py-0.5 rounded border text-[11px] transition ${
                activeEarthPos.elevation < 0
                  ? 'bg-blue-500/20 text-[#60A5FA] border-[#60A5FA]/50 font-bold'
                  : 'bg-[#080D18] text-slate-400 border-[#263449] hover:text-white'
              }`}
            >
              -1.5° (Sub-Horizon)
            </button>
            <button
              type="button"
              onClick={() => handleAdjustElevation('earth', 4.5)}
              className={`px-2 py-0.5 rounded border text-[11px] transition ${
                activeEarthPos.elevation > 0
                  ? 'bg-blue-500/20 text-[#60A5FA] border-[#60A5FA]/50 font-bold'
                  : 'bg-[#080D18] text-slate-400 border-[#263449] hover:text-white'
              }`}
            >
              +4.5° (DTE OK)
            </button>
          </div>

          {/* Reset Baseline */}
          {isOverridden && (
            <Button size="xs" variant="secondary" onClick={handleResetToBaseline}>
              <RotateCcw className="w-3 h-3" />
              Reset Override
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default HorizonSection;
