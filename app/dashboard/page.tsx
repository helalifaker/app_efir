'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatNumber } from '@/lib/utils';
import { DashboardPayload, PIVOT_YEARS, Year, MetricKey } from '@/types';
import toast from 'react-hot-toast';
import { logger } from '@/lib/logger';

function DashboardContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('revenue');
  const [selectedYear, setSelectedYear] = useState<Year | ''>('');

  // Load dashboard data
  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (selectedYear) params.set('year', selectedYear.toString());
        if (selectedMetric) params.set('metric', selectedMetric);
        
        const res = await fetch(`/api/dashboard-v2?${params.toString()}`);
        const data = await res.json();
        
        if (data) {
          setDashboardData(data);
        }
      } catch (e) {
        logger.error('Failed to load dashboard', e);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [selectedMetric, selectedYear]);

  // Handle query params
  useEffect(() => {
    const year = searchParams.get('year');
    const metric = searchParams.get('metric');
    if (year) setSelectedYear(parseInt(year, 10) as Year);
    if (metric) setSelectedMetric(metric as MetricKey);
  }, [searchParams]);

  if (loading && !dashboardData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-gray-500">No dashboard data available</div>
      </div>
    );
  }

  const { kpis, trends, heatmap, statusMatrix, alerts, aggregates } = dashboardData;

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500';
      case 'major':
        return 'bg-orange-500';
      case 'minor':
        return 'bg-yellow-500';
      default:
        return 'bg-green-500';
    }
  };

  // Get severity text color
  const getSeverityTextColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-700';
      case 'major':
        return 'text-orange-700';
      case 'minor':
        return 'text-yellow-700';
      default:
        return 'text-green-700';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Overview of your financial models and versions
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Metric</label>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as MetricKey)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="revenue">Revenue</option>
            <option value="ebitda">EBITDA</option>
            <option value="net_income">Net Income</option>
            <option value="cash">Cash</option>
            <option value="assets">Assets</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Year (optional)</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value ? (parseInt(e.target.value, 10) as Year) : '')}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">All Years</option>
            {PIVOT_YEARS.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Models</h3>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg">
              📊
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{kpis.totalModels}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Versions</h3>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-lg">
              ✓
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{kpis.totalVersions}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Ready</h3>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-lg">
              ✓
            </div>
          </div>
          <p className="text-3xl font-bold text-green-600">{kpis.readyVersions}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Locked</h3>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center text-white text-lg">
              🔒
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-600">{kpis.lockedVersions}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Draft</h3>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center text-white text-lg">
              📝
            </div>
          </div>
          <p className="text-3xl font-bold text-yellow-600">{kpis.draftVersions}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Alerts</h3>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white text-lg">
              ⚠
            </div>
          </div>
          <p className="text-3xl font-bold text-red-600">{kpis.alerts}</p>
        </div>
      </div>

      {/* Trends Chart */}
      {trends.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Trends</h2>
          <div className="space-y-6">
            {trends.map((trend, idx) => {
              const maxValue = Math.max(...trend.series.map(p => p.value || 0));
              const minValue = Math.min(...trend.series.filter(p => p.value !== null).map(p => p.value || 0));
              const range = maxValue - minValue || 1;
              
              return (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {trend.metric.replace(/_/g, ' ').toUpperCase()}
                    </h3>
                    <div className="text-xs text-slate-500">
                      Max: {formatNumber(maxValue)} | Min: {formatNumber(minValue)}
                    </div>
                  </div>
                  <div className="relative h-32 bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                    <svg className="w-full h-full" viewBox="0 0 1000 100">
                      {/* Grid lines */}
                      {[0, 25, 50, 75, 100].map(y => (
                        <line
                          key={y}
                          x1="0"
                          y1={y}
                          x2="1000"
                          y2={y}
                          stroke="#e2e8f0"
                          strokeWidth="0.5"
                        />
                      ))}
                      {/* Trend line */}
                      <polyline
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        points={trend.series
                          .filter(p => p.value !== null)
                          .map((p, i) => {
                            const x = (i / (trend.series.length - 1)) * 1000;
                            const y = 100 - ((p.value! - minValue) / range) * 100;
                            return `${x},${y}`;
                          })
                          .join(' ')}
                      />
                      {/* Historical/forecast divider */}
                      <line
                        x1={(trend.series.filter(p => p.isHistorical).length / trend.series.length) * 1000}
                        y1="0"
                        x2={(trend.series.filter(p => p.isHistorical).length / trend.series.length) * 1000}
                        y2="100"
                        stroke="#ef4444"
                        strokeWidth="1"
                        strokeDasharray="4,4"
                      />
                    </svg>
                    <div className="absolute bottom-2 left-2 text-xs text-slate-500">
                      2023-2052
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Heatmap */}
      {heatmap.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Validation Heatmap</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 font-semibold border-b">Version</th>
                  {PIVOT_YEARS.map(year => (
                    <th key={year} className="text-center px-4 py-3 font-semibold border-b">
                      {year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.slice(0, 20).map((entry, idx) => (
                  <tr key={entry.versionId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium">{entry.versionName}</td>
                    {PIVOT_YEARS.map(year => {
                      const yearData = entry.years.find(y => y.year === year);
                      const severity = yearData?.severity || 'none';
                      const issueCount = yearData?.issueCount || 0;
                      
                      return (
                        <td key={year} className="text-center px-4 py-3">
                          <div className="flex flex-col items-center gap-1">
                            <div
                              className={`w-8 h-8 rounded ${getSeverityColor(severity)}`}
                              title={`${severity}: ${issueCount} issues`}
                            />
                            {issueCount > 0 && (
                              <span className="text-xs text-slate-600">{issueCount}</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {heatmap.length > 20 && (
            <div className="mt-4 text-sm text-slate-500 text-center">
              Showing top 20 versions. Total: {heatmap.length}
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Alerts ({alerts.length})</h2>
          <div className="space-y-2">
            {alerts.slice(0, 10).map((alert, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  alert.severity === 'critical'
                    ? 'bg-red-50 border-red-200'
                    : alert.severity === 'major'
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{alert.versionName}</div>
                    <div className="text-sm text-slate-600 mt-1">{alert.issue}</div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityTextColor(alert.severity)}`}>
                    {alert.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {alerts.length > 10 && (
            <div className="mt-4 text-sm text-slate-500 text-center">
              Showing top 10 alerts. Total: {alerts.length}
            </div>
          )}
        </div>
      )}

      {/* Aggregates */}
      {aggregates.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Aggregates by Pivot Year</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 font-semibold border-b">Year</th>
                  <th className="text-right px-4 py-3 font-semibold border-b">Revenue</th>
                  <th className="text-right px-4 py-3 font-semibold border-b">EBITDA</th>
                  <th className="text-right px-4 py-3 font-semibold border-b">Net Income</th>
                  <th className="text-right px-4 py-3 font-semibold border-b">Cash</th>
                  <th className="text-right px-4 py-3 font-semibold border-b">Assets</th>
                </tr>
              </thead>
              <tbody>
                {aggregates.map((agg, idx) => (
                  <tr key={agg.year} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium">{agg.year}</td>
                    <td className="text-right px-4 py-3 font-mono">{formatNumber(agg.metrics.revenue)}</td>
                    <td className="text-right px-4 py-3 font-mono">{formatNumber(agg.metrics.ebitda)}</td>
                    <td className="text-right px-4 py-3 font-mono">{formatNumber(agg.metrics.net_income)}</td>
                    <td className="text-right px-4 py-3 font-mono">{formatNumber(agg.metrics.cash)}</td>
                    <td className="text-right px-4 py-3 font-mono">{formatNumber(agg.metrics.assets)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Status Matrix */}
      {statusMatrix.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Status Matrix</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 font-semibold border-b">Model</th>
                  <th className="text-right px-4 py-3 font-semibold border-b">Versions</th>
                  <th className="text-center px-4 py-3 font-semibold border-b">Latest Status</th>
                  <th className="text-right px-4 py-3 font-semibold border-b">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {statusMatrix.map((model, idx) => (
                  <tr key={model.modelId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium">{model.modelName}</td>
                    <td className="text-right px-4 py-3">{model.versionCount}</td>
                    <td className="text-center px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        model.latestStatus === 'Ready' ? 'bg-green-100 text-green-700' :
                        model.latestStatus === 'Locked' ? 'bg-gray-100 text-gray-700' :
                        model.latestStatus === 'Draft' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {model.latestStatus}
                      </span>
                    </td>
                    <td className="text-right px-4 py-3 text-slate-600">
                      {new Date(model.latestUpdated).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
