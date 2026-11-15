import React, { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  RotateCcw,
  Scale,
  Sun,
  Radio,
} from 'lucide-react';
import { useMission } from '../context/MissionContext';
import { LUNAR_DEMONSTRATION_SITES } from '../data/lunarSites';
import type { ComparisonScenario } from '../types/comparison';
import { evaluateScenarioMetrics, compareScenarios } from '../utils/scenarioEvaluator';
import { ComparisonCard } from './ComparisonCard';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

export const ComparisonPanel: React.FC = () => {
  const { selectedSite, missionDate, missionTime } = useMission();

  // Initial demonstration scenarios (2 scenarios default, up to 3)
  const [scenarios, setScenarios] = useState<ComparisonScenario[]>(() => {
    const siteA =
      LUNAR_DEMONSTRATION_SITES.find((s) => s.id === 'shackleton-crater') ||
      LUNAR_DEMONSTRATION_SITES[0];
    const siteB =
      LUNAR_DEMONSTRATION_SITES.find((s) => s.id === 'malapert-massif') ||
      LUNAR_DEMONSTRATION_SITES[1];

    const scnA: ComparisonScenario = {
      id: 'scenario-a',
      name: siteA.name,
      label: 'Scenario A',
      site: siteA,
      date: '2026-10-15',
      time: '12:00',
      metrics: evaluateScenarioMetrics(siteA, '2026-10-15', '12:00'),
      isDemoData: true,
      isSimulatedMissing: false,
    };

    const scnB: ComparisonScenario = {
      id: 'scenario-b',
      name: siteB.name,
      label: 'Scenario B',
      site: siteB,
      date: '2026-10-15',
      time: '12:00',
      metrics: evaluateScenarioMetrics(siteB, '2026-10-15', '12:00'),
      isDemoData: true,
      isSimulatedMissing: false,
    };

    return [scnA, scnB];
  });

  // Evaluate comparison analysis across scenarios for each individual metric
  const metricComparison = useMemo(() => {
    return compareScenarios(scenarios);
  }, [scenarios]);

  // Handlers for updating scenario properties
  const handleUpdateSite = (scenarioId: string, siteId: string) => {
    const foundSite = LUNAR_DEMONSTRATION_SITES.find((s) => s.id === siteId);
    if (!foundSite) return;

    setScenarios((prev) =>
      prev.map((scn) => {
        if (scn.id === scenarioId) {
          const newMetrics = evaluateScenarioMetrics(
            foundSite,
            scn.date,
            scn.time,
            scn.isSimulatedMissing
          );
          return {
            ...scn,
            site: foundSite,
            name: foundSite.name,
            metrics: newMetrics,
          };
        }
        return scn;
      })
    );
  };

  const handleUpdateDate = (scenarioId: string, newDate: string) => {
    setScenarios((prev) =>
      prev.map((scn) => {
        if (scn.id === scenarioId) {
          const newMetrics = evaluateScenarioMetrics(
            scn.site,
            newDate,
            scn.time,
            scn.isSimulatedMissing
          );
          return {
            ...scn,
            date: newDate,
            metrics: newMetrics,
          };
        }
        return scn;
      })
    );
  };

  const handleUpdateTime = (scenarioId: string, newTime: string) => {
    setScenarios((prev) =>
      prev.map((scn) => {
        if (scn.id === scenarioId) {
          const newMetrics = evaluateScenarioMetrics(
            scn.site,
            scn.date,
            newTime,
            scn.isSimulatedMissing
          );
          return {
            ...scn,
            time: newTime,
            metrics: newMetrics,
          };
        }
        return scn;
      })
    );
  };

  const handleToggleMissing = (scenarioId: string) => {
    setScenarios((prev) =>
      prev.map((scn) => {
        if (scn.id === scenarioId) {
          const newMissing = !scn.isSimulatedMissing;
          const newMetrics = evaluateScenarioMetrics(
            scn.site,
            scn.date,
            scn.time,
            newMissing
          );
          return {
            ...scn,
            isSimulatedMissing: newMissing,
            metrics: newMetrics,
          };
        }
        return scn;
      })
    );
  };

  const handleSyncWithActive = (scenarioId: string) => {
    setScenarios((prev) =>
      prev.map((scn) => {
        if (scn.id === scenarioId) {
          const newMetrics = evaluateScenarioMetrics(
            selectedSite,
            missionDate,
            missionTime,
            scn.isSimulatedMissing
          );
          return {
            ...scn,
            site: selectedSite,
            name: selectedSite.name,
            date: missionDate,
            time: missionTime,
            metrics: newMetrics,
          };
        }
        return scn;
      })
    );
  };

  // Add Scenario (up to 3 maximum)
  const handleAddScenario = () => {
    if (scenarios.length >= 3) return;

    // Pick a candidate site not currently in the comparison list, or fallback to site 2 or 3
    const existingSiteIds = new Set(scenarios.map((s) => s.site.id));
    const nextSite =
      LUNAR_DEMONSTRATION_SITES.find((s) => !existingSiteIds.has(s.id)) ||
      LUNAR_DEMONSTRATION_SITES[2] ||
      LUNAR_DEMONSTRATION_SITES[0];

    const label = scenarios.length === 2 ? 'Scenario C' : `Scenario ${scenarios.length + 1}`;
    const id = `scenario-${Date.now()}`;

    const newScenario: ComparisonScenario = {
      id,
      name: nextSite.name,
      label,
      site: nextSite,
      date: '2026-10-15',
      time: '12:00',
      metrics: evaluateScenarioMetrics(nextSite, '2026-10-15', '12:00'),
      isDemoData: true,
      isSimulatedMissing: false,
    };

    setScenarios((prev) => [...prev, newScenario]);
  };

  // Remove Scenario (down to 2 minimum)
  const handleRemoveScenario = (scenarioId: string) => {
    if (scenarios.length <= 2) return;
    setScenarios((prev) => {
      const filtered = prev.filter((s) => s.id !== scenarioId);
      // Re-label to Scenario A, Scenario B
      return filtered.map((s, idx) => ({
        ...s,
        label: idx === 0 ? 'Scenario A' : idx === 1 ? 'Scenario B' : 'Scenario C',
      }));
    });
  };

  // Reset to initial baseline presets
  const handleReset = () => {
    const siteA =
      LUNAR_DEMONSTRATION_SITES.find((s) => s.id === 'shackleton-crater') ||
      LUNAR_DEMONSTRATION_SITES[0];
    const siteB =
      LUNAR_DEMONSTRATION_SITES.find((s) => s.id === 'malapert-massif') ||
      LUNAR_DEMONSTRATION_SITES[1];

    setScenarios([
      {
        id: 'scenario-a',
        name: siteA.name,
        label: 'Scenario A',
        site: siteA,
        date: '2026-10-15',
        time: '12:00',
        metrics: evaluateScenarioMetrics(siteA, '2026-10-15', '12:00'),
        isDemoData: true,
        isSimulatedMissing: false,
      },
      {
        id: 'scenario-b',
        name: siteB.name,
        label: 'Scenario B',
        site: siteB,
        date: '2026-10-15',
        time: '12:00',
        metrics: evaluateScenarioMetrics(siteB, '2026-10-15', '12:00'),
        isDemoData: true,
        isSimulatedMissing: false,
      },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="p-4 rounded-lg bg-[#101827] border border-[#263449] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#38BDF8]/10 text-[#38BDF8] flex items-center justify-center border border-[#38BDF8]/20 shrink-0">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-100">
                Mission Scenario Comparison Matrix
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#152033] text-[#38BDF8] border border-[#263449]">
                Comparing {scenarios.length} of 3 Scenarios
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400">
              Multi-parameter trade-off analysis across candidate landing sites and launch epochs
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleReset}
            className="text-xs font-mono"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Presets
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={handleAddScenario}
            disabled={scenarios.length >= 3}
            title={scenarios.length >= 3 ? 'Maximum 3 scenarios reached' : 'Add third scenario to comparison'}
            className="text-xs font-mono"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Scenario {scenarios.length < 3 ? `(${scenarios.length}/3)` : '(Max 3)'}
          </Button>
        </div>
      </div>

      {/* 2. Side-by-Side Comparison Cards Grid (2 or 3 Columns) */}
      <div
        className={`grid gap-6 ${
          scenarios.length === 2
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {scenarios.map((scn, idx) => (
          <ComparisonCard
            key={scn.id}
            scenario={scn}
            baselineScenario={scenarios[0]}
            isBaseline={idx === 0}
            allSites={LUNAR_DEMONSTRATION_SITES}
            onUpdateSite={(siteId) => handleUpdateSite(scn.id, siteId)}
            onUpdateDate={(newDate) => handleUpdateDate(scn.id, newDate)}
            onUpdateTime={(newTime) => handleUpdateTime(scn.id, newTime)}
            onRemove={() => handleRemoveScenario(scn.id)}
            canRemove={scenarios.length > 2}
            onSyncActive={() => handleSyncWithActive(scn.id)}
            onToggleMissing={() => handleToggleMissing(scn.id)}
            metricComparison={metricComparison}
          />
        ))}
      </div>

      {/* 3. Detailed Side-by-Side Metric Comparison Table */}
      <Card className="p-4 bg-[#101827] border-[#263449] overflow-hidden space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#263449]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#38BDF8]" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
              Comparative Metrics Breakdown Matrix
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            Higher value optimal for individual subsystem performance
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#263449] text-[11px] text-slate-400">
                <th className="py-2 pr-4 font-semibold uppercase">Mission Metric</th>
                {scenarios.map((scn) => (
                  <th key={scn.id} className="py-2 px-3 font-semibold uppercase">
                    {scn.label} ({scn.site.name})
                  </th>
                ))}
                <th className="py-2 pl-4 font-semibold uppercase text-slate-500">
                  Individual Metric Finding
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#263449]/60">
              {/* Row 1: Solar Elevation */}
              <tr className="hover:bg-[#152033]/40 transition">
                <td className="py-3 pr-4 font-medium text-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-[#FBBF24]" />
                    <span>Solar Elevation at Landing</span>
                  </div>
                  <div className="text-[10px] text-slate-500">Power Array Grazing Angle (°)</div>
                </td>
                {scenarios.map((scn) => {
                  const val = scn.metrics.solarElevation;
                  const isLeader = metricComparison.find((m) => m.key === 'solarElevation')?.leadingScenarioId === scn.id;
                  return (
                    <td key={scn.id} className="py-3 px-3">
                      {val === null ? (
                        <span className="text-slate-500 font-bold">--</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${isLeader ? 'text-[#FBBF24]' : 'text-slate-300'}`}>
                            {val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)}°
                          </span>
                          {isLeader && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-[#FBBF24] border border-amber-500/30 font-bold">
                              OPTIMAL
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="py-3 pl-4 text-[11px] text-slate-400">
                  {(() => {
                    const comp = metricComparison.find((m) => m.key === 'solarElevation');
                    const leader = scenarios.find((s) => s.id === comp?.leadingScenarioId);
                    if (leader) {
                      return (
                        <span className="text-amber-400 font-medium">
                          {leader.label} provides highest direct solar angle ({leader.metrics.solarElevation! > 0 ? `+${leader.metrics.solarElevation?.toFixed(2)}` : leader.metrics.solarElevation?.toFixed(2)}°)
                        </span>
                      );
                    }
                    return <span>Metric comparable or data unavailable</span>;
                  })()}
                </td>
              </tr>

              {/* Row 2: Sunlight Duration */}
              <tr className="hover:bg-[#152033]/40 transition">
                <td className="py-3 pr-4 font-medium text-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span>Cumulative Sunlight Duration</span>
                  </div>
                  <div className="text-[10px] text-slate-500">14-Day Artemis Window (336h)</div>
                </td>
                {scenarios.map((scn) => {
                  const val = scn.metrics.sunlightDurationHours;
                  const pct = scn.metrics.sunlightPercentage;
                  const isLeader = metricComparison.find((m) => m.key === 'sunlightDurationHours')?.leadingScenarioId === scn.id;
                  return (
                    <td key={scn.id} className="py-3 px-3">
                      {val === null ? (
                        <span className="text-slate-500 font-bold">--</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${isLeader ? 'text-[#38BDF8]' : 'text-slate-300'}`}>
                            {val.toFixed(1)}h ({pct?.toFixed(1)}%)
                          </span>
                          {isLeader && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30 font-bold">
                              OPTIMAL
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="py-3 pl-4 text-[11px] text-slate-400">
                  {(() => {
                    const comp = metricComparison.find((m) => m.key === 'sunlightDurationHours');
                    const leader = scenarios.find((s) => s.id === comp?.leadingScenarioId);
                    if (leader) {
                      return (
                        <span className="text-[#38BDF8] font-medium">
                          {leader.label} maximizes illumination window ({leader.metrics.sunlightDurationHours?.toFixed(1)}h / {leader.metrics.sunlightPercentage?.toFixed(1)}%)
                        </span>
                      );
                    }
                    return <span>Metric comparable or data unavailable</span>;
                  })()}
                </td>
              </tr>

              {/* Row 3: Earth Elevation */}
              <tr className="hover:bg-[#152033]/40 transition">
                <td className="py-3 pr-4 font-medium text-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-[#60A5FA]" />
                    <span>Earth Elevation at Landing</span>
                  </div>
                  <div className="text-[10px] text-slate-500">Geometric Horizon Tangent (°)</div>
                </td>
                {scenarios.map((scn) => {
                  const val = scn.metrics.earthElevation;
                  const isLeader = metricComparison.find((m) => m.key === 'earthElevation')?.leadingScenarioId === scn.id;
                  return (
                    <td key={scn.id} className="py-3 px-3">
                      {val === null ? (
                        <span className="text-slate-500 font-bold">--</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${isLeader ? 'text-[#60A5FA]' : 'text-slate-300'}`}>
                            {val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)}°
                          </span>
                          {isLeader && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-500/20 text-[#60A5FA] border border-blue-500/30 font-bold">
                              OPTIMAL
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="py-3 pl-4 text-[11px] text-slate-400">
                  {(() => {
                    const comp = metricComparison.find((m) => m.key === 'earthElevation');
                    const leader = scenarios.find((s) => s.id === comp?.leadingScenarioId);
                    if (leader) {
                      return (
                        <span className="text-[#60A5FA] font-medium">
                          {leader.label} provides highest direct Earth angle ({leader.metrics.earthElevation! > 0 ? `+${leader.metrics.earthElevation?.toFixed(2)}` : leader.metrics.earthElevation?.toFixed(2)}°)
                        </span>
                      );
                    }
                    return <span>Metric comparable or data unavailable</span>;
                  })()}
                </td>
              </tr>

              {/* Row 4: Comm Visibility Duration */}
              <tr className="hover:bg-[#152033]/40 transition">
                <td className="py-3 pr-4 font-medium text-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-[#34D399]" />
                    <span>Direct-to-Earth Comm Duration</span>
                  </div>
                  <div className="text-[10px] text-slate-500">Unocculted Line-of-Sight Window (h)</div>
                </td>
                {scenarios.map((scn) => {
                  const val = scn.metrics.commVisibilityDurationHours;
                  const pct = scn.metrics.commPercentage;
                  const isLeader = metricComparison.find((m) => m.key === 'commVisibilityDurationHours')?.leadingScenarioId === scn.id;
                  return (
                    <td key={scn.id} className="py-3 px-3">
                      {val === null ? (
                        <span className="text-slate-500 font-bold">--</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${isLeader ? 'text-[#34D399]' : 'text-slate-300'}`}>
                            {val.toFixed(1)}h ({pct?.toFixed(1)}%)
                          </span>
                          {isLeader && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-[#34D399] border border-emerald-500/30 font-bold">
                              OPTIMAL
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="py-3 pl-4 text-[11px] text-slate-400">
                  {(() => {
                    const comp = metricComparison.find((m) => m.key === 'commVisibilityDurationHours');
                    const leader = scenarios.find((s) => s.id === comp?.leadingScenarioId);
                    if (leader) {
                      return (
                        <span className="text-[#34D399] font-medium">
                          {leader.label} delivers longest continuous RF link ({leader.metrics.commVisibilityDurationHours?.toFixed(1)}h / {leader.metrics.commPercentage?.toFixed(1)}%)
                        </span>
                      );
                    }
                    return <span>Metric comparable or data unavailable</span>;
                  })()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* 4. Scientific Trade-Off Principles & Anti-Arbitrary-Scoring Notice */}
      <Card className="p-4 bg-[#080D18] border border-[#263449] rounded-lg">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded bg-amber-500/10 text-[#FBBF24] border border-amber-500/20 shrink-0 mt-0.5">
            <Scale className="w-4 h-4" />
          </div>
          <div className="space-y-1 text-xs font-mono">
            <h4 className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              Scientific Trade-Off Analysis Principles
              <span className="text-[10px] text-slate-500 font-normal">
                (Independent Subsystem Evaluations)
              </span>
            </h4>
            <p className="text-slate-400 leading-relaxed font-sans text-xs">
              Lunar South Pole mission architecture selection fundamentally involves competing operational requirements. For example, high-elevation peak sites such as <strong className="text-slate-200">Malapert Massif</strong> offer near-continuous Direct-to-Earth radio visibility (~97.9%), whereas crater rim features such as <strong className="text-slate-200">Shackleton Connecting Ridge</strong> maximize solar array surface illumination (~88.7%). LunaScope highlights individual metric extrema independently and <strong className="text-amber-400">does not compute an arbitrary composite score</strong>. No single landing scenario is universally optimal across all mission profiles.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ComparisonPanel;
