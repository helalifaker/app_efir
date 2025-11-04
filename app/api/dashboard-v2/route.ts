// app/api/dashboard-v2/route.ts
// Dashboard API v2 using time-series data model
// GET /api/dashboard-v2?year=2025&metric=revenue&status=ready&model_id=UUID

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { DashboardQuerySchema } from '@/lib/schemas/timeseries';
import { DashboardPayload, SeriesPoint, PIVOT_YEARS, MetricKey } from '@/types';
import { getMetricSeries } from '@/lib/selectors/seriesBuilder';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  
  // Build query object
  const queryObj: Record<string, string | number | undefined> = {};
  const year = searchParams.get('year');
  const metric = searchParams.get('metric');
  const status = searchParams.get('status');
  const modelId = searchParams.get('model_id');
  
  if (year) queryObj.year = parseInt(year, 10);
  if (metric) queryObj.metric = metric;
  if (status) queryObj.status = status;
  if (modelId) queryObj.model_id = modelId;
  
  // Validate query params
  const validation = DashboardQuerySchema.safeParse(queryObj);
  if (!validation.success) {
    logger.warn('Invalid dashboard-v2 query params', { errors: validation.error.issues });
    return createErrorResponse('Invalid query parameters', 400, validation.error.issues);
  }
  
  const { metric: metricParam, status: statusParam, model_id: modelIdParam } = validation.data;
  
  const supabase = getServiceClient();
  
  // Build version query
  let versionQuery = supabase
    .from('model_versions')
    .select('id, name, status, model_id, created_at, updated_at, models(id, name)');
  
  if (statusParam) {
    versionQuery = versionQuery.eq('status', statusParam);
  }
  
  if (modelIdParam) {
    versionQuery = versionQuery.eq('model_id', modelIdParam);
  }
  
  const { data: versions, error: versionsError } = await versionQuery;
  
  if (versionsError) {
    logger.error('Versions fetch error', versionsError);
    return createErrorResponse('Failed to fetch versions', 500);
  }
  
  type VersionRow = {
    id: string;
    model_id: string;
    name: string;
    status: string;
    created_at: string;
    updated_at: string;
    models: { id: string; name: string } | null;
  };

  // Supabase returns models as an array, but we treat it as a single object
  const versionsList = (versions || []) as unknown as VersionRow[];
  
  // Get unique model IDs
  const modelIds = [...new Set(versionsList.map((v) => v.model_id))];
  
  // Calculate alerts count from validations (critical/major/error/warning severity)
  let alertsCount = 0;
  const versionIds = versionsList.map((v) => v.id);
  if (versionIds.length > 0) {
    const { data: criticalValidations } = await supabase
      .from('version_validations')
      .select('id')
      .in('version_id', versionIds)
      .in('severity', ['critical', 'major', 'error', 'warning']);
    
    alertsCount = criticalValidations?.length || 0;
  }
  
  // Calculate KPIs
  const kpis = {
    totalModels: modelIds.length,
    totalVersions: versionsList.length,
    readyVersions: versionsList.filter(v => v.status === 'Ready').length,
    lockedVersions: versionsList.filter(v => v.status === 'Locked').length,
    draftVersions: versionsList.filter(v => v.status === 'Draft').length,
    alerts: alertsCount,
  };
  
  // Build trends (time-series data for selected metric, or default to revenue)
  // Support multiple metrics for trends
  const trendMetrics: MetricKey[] = metricParam 
    ? [metricParam as MetricKey]
    : ['revenue', 'ebitda', 'net_income']; // Default to top 3 metrics
  
  const trends: DashboardPayload['trends'] = [];
  
  // For each trend metric, get aggregated series across all versions (or top versions)
  const topVersions = versionsList
    .filter(v => v.status === 'Ready' || v.status === 'Locked')
    .slice(0, 5); // Limit to 5 versions for performance
  
  for (const trendMetric of trendMetrics) {
    try {
      // Aggregate series across top versions (sum or average)
      const aggregatedSeries: SeriesPoint[] = [];
      const seriesByYear = new Map<number, { sum: number; count: number }>();
      
      for (const version of topVersions) {
        try {
          const series = await getMetricSeries(version.id, trendMetric);
          series.forEach(point => {
            if (point.value !== null) {
              const existing = seriesByYear.get(point.year);
              if (existing) {
                existing.sum += point.value;
                existing.count++;
              } else {
                seriesByYear.set(point.year, { sum: point.value, count: 1 });
              }
            }
          });
        } catch {
          // Skip individual version errors
        }
      }
      
      // Build aggregated series
      for (let year = 2023; year <= 2052; year++) {
        const data = seriesByYear.get(year);
        aggregatedSeries.push({
          year,
          value: data ? data.sum : null,
          isHistorical: year <= 2024,
        });
      }
      
      if (aggregatedSeries.length > 0) {
        trends.push({
          metric: trendMetric,
          series: aggregatedSeries,
        });
      }
    } catch (e) {
      logger.warn('Failed to build trend series', { metric: trendMetric, error: e });
    }
  }
  
  // Build heatmap (validation issues per version per year)
  const heatmap: DashboardPayload['heatmap'] = [];
  
  // Fetch validations for all versions (reuse versionIds from above)
  if (versionIds.length > 0) {
    const { data: validations, error: validationsError } = await supabase
      .from('version_validations')
      .select('version_id, code, message, severity')
      .in('version_id', versionIds);
    
    if (!validationsError && validations) {
      type ValidationRow = {
        version_id: string;
        code: string;
        message: string;
        severity: string;
      };

      // Group validations by version_id
      const validationsByVersion = new Map<string, ValidationRow[]>();
      (validations as ValidationRow[]).forEach((v) => {
        if (!validationsByVersion.has(v.version_id)) {
          validationsByVersion.set(v.version_id, []);
        }
        validationsByVersion.get(v.version_id)!.push(v);
      });
      
      // Build heatmap entries
      for (const version of versionsList.slice(0, 20)) { // Limit to 20 for performance
        const versionValidations = validationsByVersion.get(version.id) || [];
        
        // Determine overall severity
        const hasCritical = versionValidations.some((v) => v.severity === 'critical' || v.severity === 'error');
        const hasMajor = versionValidations.some((v) => v.severity === 'major' || v.severity === 'warning');
        
        let overallSeverity: 'critical' | 'major' | 'minor' | 'none' = 'none';
        if (hasCritical) {
          overallSeverity = 'critical';
        } else if (hasMajor) {
          overallSeverity = 'major';
        } else if (versionValidations.length > 0) {
          overallSeverity = 'minor';
        }
        
        // Group by year
        // Note: Validations don't have year context in the schema, so we apply the same severity
        // across all pivot years. In the future, if year-specific validations are needed,
        // the version_validations table could be extended with a year field or context JSONB.
        const years = PIVOT_YEARS.map(year => ({
          year,
          severity: overallSeverity,
          issueCount: versionValidations.length, // Total issues for this version across all years
        }));
        
        heatmap.push({
          versionId: version.id,
          versionName: version.name,
          years,
        });
      }
    }
  }
  
  // Build status matrix (model-level status summary)
  const statusMatrix: DashboardPayload['statusMatrix'] = [];
  
  // Group versions by model
  const versionsByModel = new Map<string, VersionRow[]>();
  versionsList.forEach((v) => {
    const modelId = v.model_id;
    if (!versionsByModel.has(modelId)) {
      versionsByModel.set(modelId, []);
    }
    versionsByModel.get(modelId)!.push(v);
  });
  
  for (const [modelId, modelVersions] of versionsByModel.entries()) {
    const firstVersion = modelVersions[0];
    const modelName = firstVersion.models?.name || 'Unknown Model';
    
    // Find latest version
    const latestVersion = modelVersions.sort((a, b) => 
      new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    )[0];
    
    statusMatrix.push({
      modelId,
      modelName,
      versionCount: modelVersions.length,
      latestStatus: latestVersion.status,
      latestUpdated: latestVersion.updated_at || latestVersion.created_at,
    });
  }
  
  // Build alerts (versions with critical/major issues) - detailed list for UI
  const alerts: DashboardPayload['alerts'] = [];
  
  if (versionIds.length > 0) {
    const { data: criticalValidations, error: alertsError } = await supabase
      .from('version_validations')
      .select('version_id, code, message, severity')
      .in('version_id', versionIds)
      .in('severity', ['critical', 'major', 'error', 'warning']);
    
    if (!alertsError && criticalValidations) {
      const versionMap = new Map(versionsList.map((v) => [v.id, v]));
      
      type ValidationAlert = {
        version_id: string;
        code: string;
        message: string;
        severity: string;
      };

      (criticalValidations as ValidationAlert[]).forEach((val) => {
        const version = versionMap.get(val.version_id);
        if (version) {
          alerts.push({
            versionId: version.id,
            versionName: version.name,
            issue: val.message || val.code,
            severity: val.severity === 'error' || val.severity === 'critical' ? 'critical' :
                     val.severity === 'warning' || val.severity === 'major' ? 'major' : 'minor',
          });
        }
      });
    }
  }
  
  // Build aggregates (aggregated metrics across all versions for pivot years)
  // Optimize: Batch fetch all metrics for all versions in one query per pivot year
  const aggregates: DashboardPayload['aggregates'] = [];
  
  const aggregateMetrics: MetricKey[] = ['revenue', 'ebitda', 'net_income', 'cash', 'assets'];
  const versionIdsForAggregates = versionsList
    .filter(v => v.status === 'Ready' || v.status === 'Locked')
    .slice(0, 50)
    .map(v => v.id);
  
  for (const pivotYear of PIVOT_YEARS) {
    const metrics: Record<string, number | null> = {};
    
    // Batch fetch all metrics for all versions for this pivot year
    if (versionIdsForAggregates.length > 0) {
      const { data: allMetrics, error: metricsError } = await supabase
        .from('version_metrics')
        .select('version_id, metric_key, value')
        .in('version_id', versionIdsForAggregates)
        .eq('year', pivotYear)
        .in('metric_key', aggregateMetrics);
      
      if (!metricsError && allMetrics) {
        // Aggregate by metric_key
        const metricsByKey = new Map<string, { sum: number; count: number }>();
        
        aggregateMetrics.forEach(key => {
          metricsByKey.set(key, { sum: 0, count: 0 });
        });
        
        type MetricRow = {
          metric_key: string;
          value: number | null;
        };

        (allMetrics as MetricRow[]).forEach((row) => {
          if (row.value !== null && row.value !== undefined) {
            const existing = metricsByKey.get(row.metric_key);
            if (existing) {
              existing.sum += row.value;
              existing.count++;
            }
          }
        });
        
        aggregateMetrics.forEach(key => {
          const data = metricsByKey.get(key);
          metrics[key] = data && data.count > 0 ? data.sum : null;
        });
      }
    }
    
    aggregates.push({
      year: pivotYear,
      metrics,
    });
  }
  
  // Build response
  const payload: DashboardPayload = {
    kpis,
    trends,
    heatmap,
    statusMatrix,
    alerts,
    aggregates,
  };
  
  logger.info('Dashboard-v2 data fetched successfully', {
    versionCount: versionsList.length,
    modelCount: kpis.totalModels,
    trendMetricsCount: trends.length,
    heatmapCount: heatmap.length,
    alertsCount: kpis.alerts,
  });
  
  return NextResponse.json(payload);
});
