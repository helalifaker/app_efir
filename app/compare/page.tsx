'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatNumber } from '@/lib/utils';
import { downloadCsv, arrayToCsv } from '@/lib/csv';
import { exportCompareToExcel } from '@/lib/xlsx';
import toast from 'react-hot-toast';

type VersionOption = {
  id: string;
  name: string;
  status: string;
  model_name: string;
};

type VersionData = {
  pnl: Record<string, any>;
  bs: Record<string, any>;
  cf: Record<string, any>;
};

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [allVersions, setAllVersions] = useState<VersionOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [baselineId, setBaselineId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [compareData, setCompareData] = useState<Record<string, VersionData>>({});
  const [allKeys, setAllKeys] = useState<{ pnl: string[]; bs: string[]; cf: string[] }>({ pnl: [], bs: [], cf: [] });
  const [activeTab, setActiveTab] = useState<'pnl' | 'bs' | 'cf'>('pnl');

  // Load all versions
  useEffect(() => {
    async function loadVersions() {
      try {
        const res = await fetch('/api/compare/versions');
        const data = await res.json();
        setAllVersions(data.versions || []);
      } catch (e) {
        console.error('Failed to load versions:', e);
      } finally {
        setLoading(false);
      }
    }
    loadVersions();
  }, []);

  // Handle deep-linking from query params
  useEffect(() => {
    const idsParam = searchParams.get('ids');
    const baselineParam = searchParams.get('baseline');
    
    if (idsParam) {
      const ids = idsParam.split(',').filter(Boolean);
      setSelectedIds(ids);
      
      if (baselineParam) {
        setBaselineId(baselineParam);
      } else if (ids.length > 0) {
        setBaselineId(ids[0]);
      }
    }
  }, [searchParams]);

  // Load compare data when selections change
  useEffect(() => {
    if (selectedIds.length === 0 || !baselineId) {
      setCompareData({});
      setAllKeys({ pnl: [], bs: [], cf: [] });
      return;
    }

    // Update URL without reloading
    const params = new URLSearchParams();
    params.set('ids', selectedIds.join(','));
    params.set('baseline', baselineId);
    router.replace(`/compare?${params.toString()}`, { scroll: false });

    async function loadCompareData() {
      try {
        const res = await fetch(`/api/compare/data?ids=${selectedIds.join(',')}&baseline=${baselineId}`);
        const data = await res.json();
        
        if (data.tabsByVersion && data.allKeys) {
          setCompareData(data.tabsByVersion);
          setAllKeys(data.allKeys);
        }
      } catch (e) {
        console.error('Failed to load compare data:', e);
      }
    }

    loadCompareData();
  }, [selectedIds, baselineId, router]);

  const addVersion = (id: string) => {
    if (selectedIds.length >= 3) return;
    if (selectedIds.includes(id)) return;
    setSelectedIds([...selectedIds, id]);
    if (!baselineId) setBaselineId(id);
  };

  const removeVersion = (id: string) => {
    const newIds = selectedIds.filter(vid => vid !== id);
    setSelectedIds(newIds);
    if (baselineId === id && newIds.length > 0) {
      setBaselineId(newIds[0]);
    }
  };

  const getValue = (versionId: string, tab: string, key: string): number => {
    const data = compareData[versionId]?.[tab as keyof VersionData]?.[key];
    if (typeof data === 'number') return data;
    if (typeof data === 'string') return parseFloat(data) || 0;
    return 0;
  };

  const calculateDelta = (versionId: string, key: string): { abs: number; pct: number } => {
    const baseline = getValue(baselineId, activeTab, key);
    const value = getValue(versionId, activeTab, key);
    const abs = value - baseline;
    const pct = baseline !== 0 ? (abs / Math.abs(baseline)) * 100 : 0;
    return { abs, pct };
  };

  const exportCompare = async (format: 'xlsx' | 'csv') => {
    if (selectedIds.length === 0 || !baselineId) {
      toast.error('Please select versions to compare');
      return;
    }

    try {
      const versions = selectedIds.map(id => {
        const v = allVersions.find(v => v.id === id);
        return {
          id,
          name: v?.name || id,
          status: v?.status || '',
          model_name: v?.model_name || '',
        };
      });

      const dataByVersion: Record<string, Record<string, any>> = {};
      selectedIds.forEach(id => {
        dataByVersion[id] = compareData[id]?.[activeTab] || {};
      });

      if (format === 'xlsx') {
        await exportCompareToExcel({
          tabName: activeTab,
          versions,
          baselineId,
          dataByVersion,
          allKeys: allKeys[activeTab],
        });
        toast.success(`${activeTab.toUpperCase()} comparison exported to Excel`);
      } else {
        // CSV export
        const baselineVersion = allVersions.find(v => v.id === baselineId);
        const baselineName = baselineVersion?.name || baselineId;
        
        const rows: (string | number)[][] = [];
        
        // Metadata header
        rows.push(['Comparison Tab', activeTab.toUpperCase()]);
        rows.push(['Baseline Version', baselineName]);
        rows.push(['Export Date', new Date().toLocaleDateString()]);
        rows.push([]);
        rows.push(['Versions Included:', '']);
        versions.forEach(v => rows.push([v.name, v.status]));
        rows.push([]);
        
        // Header
        const headers: (string | number)[] = ['Metric', baselineName];
        const comparisonVersions = selectedIds.filter(id => id !== baselineId);
        comparisonVersions.forEach(id => {
          const v = allVersions.find(v => v.id === id);
          headers.push(v?.name || id, `${v?.name || id} Δ Abs`, `${v?.name || id} Δ %`);
        });
        rows.push(headers);

        // Data rows
        allKeys[activeTab].forEach(key => {
          const row: (string | number)[] = [key];
          row.push(formatNumber(getValue(baselineId, activeTab, key)));
          
          comparisonVersions.forEach(versionId => {
            const value = getValue(versionId, activeTab, key);
            const delta = calculateDelta(versionId, key);
            row.push(formatNumber(value));
            row.push(formatNumber(delta.abs));
            row.push(`${delta.pct.toFixed(2)}%`);
          });
          
          rows.push(row);
        });

        const csvContent = arrayToCsv(rows);
        downloadCsv(csvContent, `compare_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
        toast.success(`${activeTab.toUpperCase()} comparison exported to CSV`);
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(`Failed to export: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <main className="p-6">
        <div className="text-center text-gray-500">Loading versions...</div>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-4">
      <div className="sticky top-0 bg-white z-10 pb-4 border-b">
        <h1 className="text-2xl font-semibold mb-4">Compare Versions</h1>
        
        {/* Version Selectors */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Baseline</label>
            <select
              value={baselineId}
              onChange={(e) => setBaselineId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={selectedIds.length === 0}
            >
              <option value="">Select baseline...</option>
              {selectedIds.map(id => {
                const v = allVersions.find(v => v.id === id);
                return <option key={id} value={id}>{v?.name || id}</option>;
              })}
            </select>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">
              Compare Versions {selectedIds.length}/3
            </label>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addVersion(e.target.value);
                  e.target.value = '';
                }
              }}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={selectedIds.length >= 3}
            >
              <option value="">Add version...</option>
              {allVersions.filter(v => !selectedIds.includes(v.id)).map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.model_name})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Versions */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedIds.map(id => {
              const v = allVersions.find(v => v.id === id);
              const isBaseline = id === baselineId;
              return (
                <div
                  key={id}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full border ${
                    isBaseline
                      ? 'bg-blue-100 border-blue-300 text-blue-800'
                      : 'bg-gray-100 border-gray-300'
                  }`}
                >
                  <span className="text-sm font-medium">{v?.name || id}</span>
                  {isBaseline && <span className="text-xs">(Baseline)</span>}
                  <button
                    onClick={() => removeVersion(id)}
                    className="text-gray-500 hover:text-red-600 text-sm"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Empty State */}
      {selectedIds.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No versions selected</p>
          <p className="text-sm">Select up to 3 versions to compare</p>
        </div>
      )}

      {/* Compare Table */}
      {selectedIds.length > 0 && baselineId && allKeys[activeTab].length > 0 && (
        <div className="space-y-4">
          {/* Tab Selector */}
          <div className="flex gap-2 border-b">
            {(['pnl', 'bs', 'cf'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium ${
                  activeTab === tab
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => exportCompare('xlsx')}
                className="px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg"
              >
                📊 Export Excel
              </button>
              <button
                onClick={() => exportCompare('csv')}
                className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
              >
                📄 Export CSV
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Metric</th>
                  <th className="text-right px-4 py-3 font-semibold bg-blue-50">
                    {allVersions.find(v => v.id === baselineId)?.name || 'Baseline'}
                  </th>
                  {selectedIds.filter(id => id !== baselineId).map(id => {
                    const v = allVersions.find(v => v.id === id);
                    return (
                      <th key={id} colSpan={3} className="text-center px-4 py-3 font-semibold">
                        {v?.name || id}
                      </th>
                    );
                  })}
                </tr>
                {selectedIds.filter(id => id !== baselineId).length > 0 && (
                  <tr className="bg-gray-50 border-b text-xs">
                    <th className="px-4 py-2"></th>
                    <th className="px-4 py-2"></th>
                    {selectedIds.filter(id => id !== baselineId).map((_, idx) => (
                      <React.Fragment key={idx}>
                        <th className="text-right px-4 py-2 font-normal">Value</th>
                        <th className="text-right px-4 py-2 font-normal">Δ Abs</th>
                        <th className="text-right px-4 py-2 font-normal">Δ %</th>
                      </React.Fragment>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {allKeys[activeTab].map((key, idx) => (
                  <tr key={key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium">{key}</td>
                    <td className="text-right px-4 py-3 font-mono">
                      {formatNumber(getValue(baselineId, activeTab, key))}
                    </td>
                    {selectedIds.filter(id => id !== baselineId).map((versionId, vIdx) => {
                      const value = getValue(versionId, activeTab, key);
                      const delta = calculateDelta(versionId, key);
                      return (
                        <React.Fragment key={vIdx}>
                          <td className="text-right px-4 py-3 font-mono">
                            {formatNumber(value)}
                          </td>
                          <td className={`text-right px-4 py-3 font-mono ${
                            delta.abs > 0 ? 'text-green-600' : delta.abs < 0 ? 'text-red-600' : ''
                          }`}>
                            {delta.abs > 0 ? '+' : ''}{formatNumber(delta.abs)}
                          </td>
                          <td className={`text-right px-4 py-3 font-mono text-xs ${
                            delta.pct > 0 ? 'text-green-600' : delta.pct < 0 ? 'text-red-600' : ''
                          }`}>
                            {delta.pct > 0 ? '+' : ''}{delta.pct.toFixed(2)}%
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="text-xs text-gray-500 flex gap-4">
            <span>• Baseline: Primary comparison reference</span>
            <span>• Δ Abs: Absolute difference vs baseline</span>
            <span>• Δ %: Percentage difference vs baseline</span>
            <span>• Green = positive delta, Red = negative delta</span>
          </div>
        </div>
      )}

      {/* No Data State */}
      {selectedIds.length > 0 && baselineId && allKeys[activeTab].length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No {activeTab.toUpperCase()} data available for selected versions</p>
        </div>
      )}
    </main>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <CompareContent />
    </Suspense>
  );
}
