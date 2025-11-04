// app/api/compare-v2/route.ts
// Compare API v2 using time-series data model
// GET /api/compare-v2?left=UUID&right=UUID&third=UUID&baseline=UUID&focusYear=2025&metric=revenue

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { CompareQuerySchema } from '@/lib/schemas/timeseries';
import { ComparePayload, PivotYear } from '@/types';
import { PIVOT_YEARS, MetricKey } from '@/types';
// Note: Using direct Supabase queries for better performance in pivot year queries

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  
  // Build query object
  const queryObj: Record<string, string | number | undefined> = {};
  const left = searchParams.get('left');
  const right = searchParams.get('right');
  const third = searchParams.get('third');
  const baseline = searchParams.get('baseline');
  const focusYear = searchParams.get('focusYear');
  const metric = searchParams.get('metric');
  
  if (left) queryObj.left = left;
  if (right) queryObj.right = right;
  if (third) queryObj.third = third;
  if (baseline) queryObj.baseline = baseline;
  if (focusYear) queryObj.focusYear = parseInt(focusYear, 10);
  if (metric) queryObj.metric = metric;
  
  // Validate query params
  const validation = CompareQuerySchema.safeParse(queryObj);
  if (!validation.success) {
    logger.warn('Invalid compare-v2 query params', { errors: validation.error.issues });
    return createErrorResponse('Invalid query parameters', 400, validation.error.issues);
  }
  
  const { left: leftId, right: rightId, third: thirdId, baseline: baselineId, focusYear: focusYearParam, metric: metricParam } = validation.data;
  
  const supabase = getServiceClient();
  
  // Fetch version metadata
  const versionIds = [leftId, rightId, thirdId].filter(Boolean) as string[];
  const { data: versions, error: versionsError } = await supabase
    .from('model_versions')
    .select('id, name, status, model_id, models(name)')
    .in('id', versionIds);
  
  if (versionsError || !versions || versions.length === 0) {
    logger.error('Versions fetch error', versionsError, { versionIds });
    return createErrorResponse('Failed to fetch versions', 500);
  }
  
  type VersionRow = {
    id: string;
    name: string;
    status: string;
    models: { name: string }[] | null;
  };

  // Build version info map
  const versionRows = versions as unknown as VersionRow[];
  const versionMap = new Map(versionRows.map((v) => [v.id, {
    id: v.id,
    name: v.name,
    status: v.status,
    model_name: Array.isArray(v.models) && v.models[0] ? v.models[0].name : 'Unknown Model',
  }]));
  
  // Determine baseline (defaults to left)
  const baselineVersionId = baselineId || leftId;
  const baselineVersion = versionMap.get(baselineVersionId);
  
  if (!baselineVersion) {
    return createErrorResponse('Baseline version not found', 404);
  }
  
  const leftVersion = versionMap.get(leftId);
  if (!leftVersion) {
    return createErrorResponse('Left version not found', 404);
  }
  
  // Focus year (defaults to first pivot year)
  const focusYearValue: number = focusYearParam || PIVOT_YEARS[0];
  
  // Get all metrics for pivot years across all versions
  const allMetricKeys: MetricKey[] = metricParam ? [metricParam as MetricKey] : [
    'revenue',
    'ebitda',
    'net_income',
    'cash',
    'assets',
    'liabilities',
    'equity',
  ];
  
  // Build pivot data - calculate metrics and deltas for all versions vs baseline
  const pivotData: ComparePayload['pivotData'] = [];
  
  // Get all version IDs to compare (excluding baseline from comparison list)
  const compareVersionIds = [leftId, rightId, thirdId]
    .filter(Boolean)
    .filter(id => id !== baselineVersionId) as string[];
  
  // Fetch all metrics for all versions and baseline in one go (efficient)
  const allVersionIds = [baselineVersionId, ...compareVersionIds];
  
  for (const pivotYear of PIVOT_YEARS) {
    const metricsByVersion: Record<string, Record<string, number | null>> = {};
    
    // Fetch metrics for all versions for this pivot year
    for (const versionId of allVersionIds) {
      metricsByVersion[versionId] = {};
      
      // Fetch all metrics for this version and year in one query
      const { data: versionMetrics, error: metricsError } = await supabase
        .from('version_metrics')
        .select('metric_key, value')
        .eq('version_id', versionId)
        .eq('year', pivotYear)
        .in('metric_key', allMetricKeys);
      
      if (metricsError) {
        logger.warn('Failed to fetch metrics', { versionId, year: pivotYear, error: metricsError });
      }
      
      type MetricRow = {
        metric_key: string;
        value: number | null;
      };

      // Build metrics map
      (versionMetrics || []).forEach((row: MetricRow) => {
        metricsByVersion[versionId][row.metric_key] = row.value;
      });
      
      // Fill in nulls for missing metrics
      allMetricKeys.forEach(key => {
        if (!(key in metricsByVersion[versionId])) {
          metricsByVersion[versionId][key] = null;
        }
      });
    }
    
    // Use left version's metrics as primary (for backwards compatibility)
    const primaryMetrics = metricsByVersion[leftId] || {};
    const baselineMetrics = metricsByVersion[baselineVersionId] || {};
    
    // Calculate deltas for all versions vs baseline
    const deltas: Record<string, { abs: number; pct: number }> = {};
    const deltasByVersion: Record<string, Record<string, { abs: number; pct: number }>> = {};
    
    // Calculate deltas for each comparison version
    for (const versionId of compareVersionIds) {
      const versionMetrics = metricsByVersion[versionId] || {};
      deltasByVersion[versionId] = {};
      
      for (const metricKey of allMetricKeys) {
        const baselineValue = baselineMetrics[metricKey];
        const versionValue = versionMetrics[metricKey];
        
        if (baselineValue !== null && versionValue !== null) {
          const absDelta = versionValue - baselineValue;
          const pctDelta = baselineValue !== 0 ? (absDelta / Math.abs(baselineValue)) * 100 : 0;
          deltasByVersion[versionId][metricKey] = { abs: absDelta, pct: pctDelta };
        }
      }
    }
    
    // Calculate deltas for left version (if different from baseline) - for backwards compatibility
    if (leftId !== baselineVersionId) {
      const leftDeltas = deltasByVersion[leftId] || {};
      Object.assign(deltas, leftDeltas);
    }
    
    // Build pivot data entry
    type PivotEntry = {
      year: PivotYear;
      metrics: Record<string, number | null>;
      metricsByVersion?: Record<string, Record<string, number | null>>;
      deltas?: Record<string, { abs: number; pct: number }>;
      deltasByVersion?: Record<string, Record<string, { abs: number; pct: number }>>;
    };

    const pivotEntry: PivotEntry = {
      year: pivotYear,
      metrics: primaryMetrics,
    };
    
    // Include metrics for all versions if multiple versions
    if (compareVersionIds.length > 0) {
      pivotEntry.metricsByVersion = metricsByVersion;
    }
    
    // Include deltas if any
    if (Object.keys(deltas).length > 0) {
      pivotEntry.deltas = deltas;
    }
    
    // Include deltas for all versions if multiple versions
    if (Object.keys(deltasByVersion).length > 0) {
      pivotEntry.deltasByVersion = deltasByVersion;
    }
    
    pivotData.push(pivotEntry);
  }
  
  // Calculate KPIs (from focus year) for all versions
  const focusPivotData = pivotData.find(p => p.year === focusYearValue) || pivotData[0];
  const kpis = {
    revenue: focusPivotData.metrics.revenue ?? null,
    ebitda: focusPivotData.metrics.ebitda ?? null,
    ebitda_percent: focusPivotData.metrics.revenue && focusPivotData.metrics.ebitda
      ? (focusPivotData.metrics.ebitda / focusPivotData.metrics.revenue) * 100
      : null,
    net_income: focusPivotData.metrics.net_income ?? null,
    cash: focusPivotData.metrics.cash ?? null,
  };
  
  // Calculate KPIs for all versions if multiple versions
  const kpisByVersion: Record<string, typeof kpis> = {};
  if (focusPivotData.metricsByVersion) {
    for (const versionId of allVersionIds) {
      const versionMetrics = focusPivotData.metricsByVersion[versionId] || {};
      kpisByVersion[versionId] = {
        revenue: versionMetrics.revenue ?? null,
        ebitda: versionMetrics.ebitda ?? null,
        ebitda_percent: versionMetrics.revenue && versionMetrics.ebitda
          ? (versionMetrics.ebitda / versionMetrics.revenue) * 100
          : null,
        net_income: versionMetrics.net_income ?? null,
        cash: versionMetrics.cash ?? null,
      };
    }
  }
  
  // Build response
  const payload: ComparePayload = {
    left: leftVersion,
    ...(rightId && { right: versionMap.get(rightId) }),
    ...(thirdId && { third: versionMap.get(thirdId) }),
    baselineId: baselineVersionId,
    focusYear: focusYearValue,
    ...(metricParam && { focusMetric: metricParam as MetricKey }),
    pivotData,
    kpis,
    ...(Object.keys(kpisByVersion).length > 0 && { kpisByVersion }),
  };
  
  logger.info('Compare-v2 data fetched successfully', {
    leftId,
    rightId,
    thirdId,
    baselineId: baselineVersionId,
    focusYear: focusYearValue,
    metricKeys: allMetricKeys,
    pivotYears: PIVOT_YEARS,
  });
  
  return NextResponse.json(payload);
});
