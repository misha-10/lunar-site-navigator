import React, { useEffect, useState } from 'react';
import {
  Activity,
  Server,
  Clock,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { NavItemId } from './Sidebar';
import { missionApi, type BackendConnectionStatus } from '../../services/missionApi';

export interface TopbarProps {
  activePage: NavItemId;
  className?: string;
}

const PAGE_TITLES: Record<NavItemId, { title: string; subtitle: string }> = {
  overview: {
    title: 'Mission Overview',
    subtitle: 'High-level status & candidate lunar surface trajectories',
  },
  planner: {
    title: 'Mission Planner',
    subtitle: 'South Pole surface illumination, line-of-sight & timeline planner',
  },
  comparison: {
    title: 'Site Comparison',
    subtitle: 'Candidate landing site matrix & trade-off evaluations',
  },
  sources: {
    title: 'Data Sources',
    subtitle: 'NAIF SPICE ephemeris (DE421), IAU lunar frames & topocentric horizons',
  },
  settings: {
    title: 'System Settings',
    subtitle: 'Simulation fidelity, coordinate models & display options',
  },
};

export const Topbar: React.FC<TopbarProps> = ({
  activePage,
  className = '',
}) => {
  const [utcTime, setUtcTime] = useState<string>('');
  const [backendStatus, setBackendStatus] = useState<BackendConnectionStatus>({
    isConnected: false,
    endpoint: missionApi.getBaseUrl(),
  });

  // Live UTC Clock for aerospace operations
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toISOString().slice(11, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Periodic Backend Health Probe (every 10 seconds)
  useEffect(() => {
    let isMounted = true;
    const probe = async () => {
      const status = await missionApi.checkHealth();
      if (isMounted) setBackendStatus(status);
    };
    probe();
    const interval = setInterval(probe, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const pageInfo = PAGE_TITLES[activePage] || PAGE_TITLES.planner;

  return (
    <header
      className={`h-16 bg-[#101827] border-b border-[#263449] px-6 flex items-center justify-between shrink-0 select-none ${className}`}
    >
      {/* Current Page Title & Breadcrumb Hierarchy */}
      <div className="flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-100 truncate">
            {pageInfo.title}
          </h1>
          <span className="text-slate-600 hidden sm:inline">/</span>
          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline truncate">
            {pageInfo.subtitle}
          </span>
        </div>
      </div>

      {/* Operational Indicators & Interface Controls */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Mission Status Indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#152033] border border-[#263449]">
          <Activity className="w-3.5 h-3.5 text-[#34D399]" />
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            STATUS:
          </span>
          <span className="text-[11px] font-mono font-semibold text-[#34D399]">
            NOMINAL
          </span>
        </div>

        {/* Dynamic Backend Connection & Ephemeris Status */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#152033] border border-[#263449]"
          title={
            backendStatus.isConnected
              ? `Connected to ${backendStatus.endpoint} (${backendStatus.latencyMs}ms) - Real NASA SPICE Ephemeris Active`
              : `Backend at ${backendStatus.endpoint} unreachable. Operating in standalone demo mode.`
          }
        >
          <Server className={`w-3.5 h-3.5 ${backendStatus.isConnected ? 'text-[#34D399]' : 'text-slate-400'}`} />
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 hidden lg:inline">
            BACKEND:
          </span>
          <Badge
            variant={backendStatus.isConnected ? 'success' : 'neutral'}
            hasDot
          >
            {backendStatus.isConnected
              ? `LIVE SPICE (${backendStatus.latencyMs}ms)`
              : 'STANDALONE DEMO'}
          </Badge>
        </div>

        <div className="h-4 w-px bg-[#263449] hidden sm:block" />

        {/* User-Independent UTC Clock */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#080D18] border border-[#263449] text-xs font-mono text-slate-200">
          <Clock className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span className="tabular-nums font-semibold tracking-wider">
            {utcTime || '00:00:00 UTC'}
          </span>
        </div>
      </div>
    </header>
  );
};
