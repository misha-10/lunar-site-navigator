import React, { useState } from 'react';
import { Sidebar, NavItemId } from './Sidebar';
import { Topbar } from './Topbar';
import { MissionMetricsSection } from '../MissionMetricsSection';
import { MissionControls } from '../MissionControls';
import { MoonScene } from '../MoonScene';
import { HorizonSection } from '../HorizonSection';
import { MissionTimelineSection } from '../MissionTimelineSection';
import { ComparisonPanel } from '../ComparisonPanel';
import { MissionSummary } from '../MissionSummary';

export interface DashboardLayoutProps {
  initialPage?: NavItemId;
  children?: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  initialPage = 'planner',
  children,
}) => {
  const [activePage, setActivePage] = useState<NavItemId>(initialPage);

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#080D18] text-slate-100 font-sans">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar activePage={activePage} onSelectPage={setActivePage} />

      {/* 2. Right Main Application Region */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Topbar Header */}
        <Topbar activePage={activePage} />

        {/* Responsive Content Container */}
        <main
          className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-6 bg-[#080D18]"
          role="main"
          aria-label="Operational Workspace"
        >
          <div className="h-full w-full max-w-7xl mx-auto flex flex-col">
            {children ? (
              children
            ) : activePage === 'overview' ? (
              <div className="space-y-6 pb-6">
                {/* 1. Subsystem Telemetry Metric Cards */}
                <MissionMetricsSection />

                {/* 2. Executive Mission Summary & Subsystem Briefing */}
                <div className="w-full">
                  <MissionSummary />
                </div>
              </div>
            ) : activePage === 'planner' ? (
              <div className="space-y-6 pb-6">
                {/* 1. Mission Metric Cards Banner: 4 Key Subsystem Metrics */}
                <MissionMetricsSection />

                {/* 2. Middle Row: 3D Lunar Stage (7 cols) & Mission Controls (5 cols) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[480px]">
                  {/* Left / Primary: 3D Lunar Orbital Globe (7 cols) */}
                  <div className="lg:col-span-7 h-[420px] lg:h-auto min-h-[420px] flex flex-col">
                    <MoonScene className="flex-1" />
                  </div>

                  {/* Right: Mission Selection & Temporal Epoch Controls (5 cols) */}
                  <div className="lg:col-span-5 flex flex-col">
                    <MissionControls />
                  </div>
                </div>

                {/* 3. Lower Row: Local Horizon Visualization (Sun, Earth, 0° Horizon, Az/El Telemetry) */}
                <div className="w-full">
                  <HorizonSection />
                </div>

                {/* 4. Mission Timeline & Charts (Solar Illumination & Earth Comm Visibility Over Time) */}
                <div className="w-full">
                  <MissionTimelineSection />
                </div>

                {/* 5. Executive Mission Summary & Transparent Feasibility Assessment */}
                <div className="w-full">
                  <MissionSummary />
                </div>
              </div>
            ) : activePage === 'comparison' ? (
              <div className="space-y-6 pb-6">
                <ComparisonPanel />
              </div>
            ) : (
              /* Content placeholder for other navigation views */
              <div className="h-full w-full rounded-lg border border-[#263449] bg-[#101827] p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-[#263449] pb-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      ACTIVE OPERATIONAL MODULE
                    </span>
                    <h2 className="text-base font-mono font-bold uppercase text-slate-100">
                      {activePage.toUpperCase()} MODULE
                    </h2>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#152033] text-[#38BDF8] border border-[#263449]">
                    STANDBY
                  </span>
                </div>

                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center space-y-2 max-w-md">
                    <div className="text-xs font-mono uppercase tracking-wider text-[#38BDF8]">
                      {activePage.toUpperCase()} Workspace
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans">
                      Switch back to <strong className="text-slate-200">Mission Planner</strong> to inspect the 3D Lunar Globe, mission metric cards, and local horizon visualization.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[#263449] pt-3 text-[11px] font-mono text-slate-500">
                  <span>LunaScope Shell v0.1.0</span>
                  <span>Grid: 100% Responsive</span>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
