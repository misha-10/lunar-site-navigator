import React from 'react';
import {
  LayoutDashboard,
  Compass,
  Layers,
  Database,
  Settings,
  Orbit,
  ChevronRight,
} from 'lucide-react';

export type NavItemId =
  | 'overview'
  | 'planner'
  | 'comparison'
  | 'sources'
  | 'settings';

export interface NavItemConfig {
  id: NavItemId;
  label: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
  },
  {
    id: 'planner',
    label: 'Mission Planner',
    icon: Compass,
    badge: 'Active',
  },
  {
    id: 'comparison',
    label: 'Site Comparison',
    icon: Layers,
  },
  {
    id: 'sources',
    label: 'Data Sources',
    icon: Database,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
  },
];

export interface SidebarProps {
  activePage: NavItemId;
  onSelectPage: (id: NavItemId) => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onSelectPage,
  className = '',
}) => {
  return (
    <aside
      className={`w-64 bg-[#101827] border-r border-[#263449] flex flex-col justify-between shrink-0 h-full select-none ${className}`}
      aria-label="Mission Control Navigation"
    >
      {/* Top Branding & Navigation */}
      <div className="flex flex-col">
        {/* LunaScope Logo & Header */}
        <div className="h-16 flex items-center px-5 border-b border-[#263449] gap-3">
          <div className="w-8 h-8 rounded bg-[#152033] border border-[#263449] flex items-center justify-center text-[#38BDF8] shrink-0">
            <Orbit className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-mono font-bold text-sm tracking-wider text-slate-100 uppercase truncate">
              LunaScope
            </span>
            <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
              NASA SP-LSP
            </span>
          </div>
        </div>

        {/* Primary Navigation Links */}
        <nav className="p-3 space-y-1">
          <div className="px-3 pt-2 pb-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-500 font-semibold">
            Operations
          </div>

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectPage(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-mono transition-colors group ${
                  isActive
                    ? 'bg-[#152033] text-[#38BDF8] border border-[#38BDF8]/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#152033]/60 border border-transparent'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive
                        ? 'text-[#38BDF8]'
                        : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge ? (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${
                      isActive
                        ? 'bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30'
                        : 'bg-[#152033] text-slate-500 border border-[#263449]'
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : (
                  isActive && (
                    <ChevronRight className="w-3.5 h-3.5 text-[#38BDF8]" />
                  )
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Status Info */}
      <div className="p-4 border-t border-[#263449] bg-[#080D18]/50">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
          <span className="uppercase text-slate-500">Target Body</span>
          <span className="text-slate-200 font-medium">Moon (South Pole)</span>
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
          <span className="uppercase text-slate-500">Mission Ref</span>
          <span className="text-[#38BDF8] font-medium">ARTEMIS-III</span>
        </div>
        <div className="flex items-center gap-1.5 pt-2 border-t border-[#263449]/60 text-[10px] font-mono text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
          <span>SYS ARCHITECTURE READY</span>
        </div>
      </div>
    </aside>
  );
};
