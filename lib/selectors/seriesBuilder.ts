// lib/selectors/seriesBuilder.ts
// Build time-series arrays (30-year) from version_metrics table
//
// Functions:
// - getMetricSeries: Fetch a single metric for all years (2023-2052)
// - getMultipleMetricSeries: Fetch multiple metrics efficiently
// - getPivotYearData: Extract data for pivot years only
// - getHistoricalSeries: Extract only historical years (2023-2024)
// - getForecastSeries: Extract only forecast years (2025-2052)

import { Year, SeriesPoint, PIVOT_YEARS, HISTORY_YEARS, FORECAST_START, FORECAST_END } from '@/types';
import { getServiceClient } from '@/lib/supabaseServer';
import { unstable_cache } from 'next/cache';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================
export type MetricSeries = SeriesPoint[];
export type MultipleMetricSeries = Record<string, MetricSeries>;

// ============================================================================
// SINGLE METRIC SERIES
// ============================================================================

/**
 * Fetch a single metric series for all years (2023-2052)
 * 
 * Returns an array of SeriesPoint objects ordered by year.
 */
export async function getMetricSeries(
  versionId: string,
  metricKey: string,
  startYear?: Year,
  endYear?: Year
): Promise<MetricSeries> {
  const supabase = getServiceClient();

  const start = startYear ?? 2023;
  const end = endYear ?? 2052;

  const { data, error } = await supabase
    .from('version_metrics')
    .select('year, value, is_historical')
    .eq('version_id', versionId)
    .eq('metric_key', metricKey)
    .gte('year', start)
    .lte('year', end)
    .order('year', { ascending: true });

  if (error) {
    logger.error('Error fetching metric series', error, { metricKey, start, end, operation: 'get_metric_series' });
    throw error;
  }

  // Build series with all years (fill missing years with null)
  const series: MetricSeries = [];
  const dataByYear = new Map<number, { value: number | null; is_historical: boolean }>();
  
  (data || []).forEach((row: { year: number; value: number | null; is_historical: boolean }) => {
    dataByYear.set(row.year, {
      value: row.value,
      is_historical: row.is_historical,
    });
  });

  for (let year = start; year <= end; year++) {
    const row = dataByYear.get(year);
    series.push({
      year,
      value: row?.value ?? null,
      isHistorical: row?.is_historical ?? false,
    });
  }

  return series;
}

// ============================================================================
// MULTIPLE METRIC SERIES
// ============================================================================

/**
 * Fetch multiple metric series efficiently (single query)
 * 
 * Returns a record where keys are metric keys and values are series arrays.
 */
export async function getMultipleMetricSeries(
  versionId: string,
  metricKeys: string[],
  startYear?: Year,
  endYear?: Year
): Promise<MultipleMetricSeries> {
  if (metricKeys.length === 0) {
    return {};
  }

  const supabase = getServiceClient();

  const start = startYear ?? 2023;
  const end = endYear ?? 2052;

  const { data, error } = await supabase
    .from('version_metrics')
    .select('metric_key, year, value, is_historical')
    .eq('version_id', versionId)
    .in('metric_key', metricKeys)
    .gte('year', start)
    .lte('year', end)
    .order('year', { ascending: true });

  if (error) {
    logger.error('Error fetching multiple metric series', error, { versionId, metricKeys, start, end, operation: 'get_multiple_metric_series' });
    throw error;
  }

  // Initialize result structure
  const result: MultipleMetricSeries = {};
  metricKeys.forEach((key) => {
    result[key] = [];
  });

  // Group by metric_key
  const dataByMetric = new Map<string, Map<number, { value: number | null; is_historical: boolean }>>();
  
  metricKeys.forEach((key) => {
    dataByMetric.set(key, new Map());
  });

  (data || []).forEach((row: { metric_key: string; year: number; value: number | null; is_historical: boolean }) => {
    const metricMap = dataByMetric.get(row.metric_key);
    if (metricMap) {
      metricMap.set(row.year, {
        value: row.value,
        is_historical: row.is_historical,
      });
    }
  });

  // Build series for each metric
  metricKeys.forEach((metricKey) => {
    const metricMap = dataByMetric.get(metricKey)!;
    const series: MetricSeries = [];

    for (let year = start; year <= end; year++) {
      const row = metricMap.get(year);
      series.push({
        year,
        value: row?.value ?? null,
        isHistorical: row?.is_historical ?? false,
      });
    }

    result[metricKey] = series;
  });

  return result;
}

// ============================================================================
// FILTERED SERIES
// ============================================================================

/**
 * Extract pivot year data from a series
 */
export function getPivotYearData(series: MetricSeries): MetricSeries {
  return series.filter((point) => (PIVOT_YEARS as readonly number[]).includes(point.year));
}

/**
 * Extract historical years (2023-2024) from a series
 */
export function getHistoricalSeries(series: MetricSeries): MetricSeries {
  return series.filter((point) => (HISTORY_YEARS as readonly number[]).includes(point.year));
}

/**
 * Extract forecast years (2025-2052) from a series
 */
export function getForecastSeries(series: MetricSeries): MetricSeries {
  return series.filter((point) => point.year >= FORECAST_START && point.year <= FORECAST_END);
}

// ============================================================================
// CACHED VERSIONS
// ============================================================================

/**
 * Cached version of getMetricSeries (for use in Server Components)
 */
export const getMetricSeriesCached = unstable_cache(
  async (versionId: string, metricKey: string, startYear?: Year, endYear?: Year) => {
    return getMetricSeries(versionId, metricKey, startYear, endYear);
  },
  ['metric-series'],
  {
    tags: ['metric-series'],
    revalidate: 3600, // 1 hour
  }
);

/**
 * Cached version of getMultipleMetricSeries
 */
export const getMultipleMetricSeriesCached = unstable_cache(
  async (versionId: string, metricKeys: string[], startYear?: Year, endYear?: Year) => {
    return getMultipleMetricSeries(versionId, metricKeys, startYear, endYear);
  },
  ['multiple-metric-series'],
  {
    tags: ['multiple-metric-series'],
    revalidate: 3600, // 1 hour
  }
);

// ============================================================================
// HELPER: Get all metrics for a version (all years, all metrics)
// ============================================================================

/**
 * Fetch all metrics for a version (efficient for initial load)
 * 
 * This is useful for building a complete dataset for a version.
 */
export async function getAllMetricsForVersion(
  versionId: string
): Promise<Record<string, Record<Year, number | null>>> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('version_metrics')
    .select('metric_key, year, value')
    .eq('version_id', versionId)
    .order('year', { ascending: true });

  if (error) {
    logger.error('Error fetching all metrics', error, { versionId, operation: 'get_all_metrics' });
    throw error;
  }

  const result: Record<string, Record<Year, number | null>> = {};

  (data || []).forEach((row: { metric_key: string; year: Year; value: number | null }) => {
    if (!result[row.metric_key]) {
      result[row.metric_key] = {} as Record<Year, number | null>;
    }
    result[row.metric_key][row.year] = row.value;
  });

  return result;
}
