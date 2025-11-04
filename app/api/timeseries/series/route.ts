// app/api/timeseries/series/route.ts
// GET time-series data for a specific metric
// Query params: version_id, metric_key, start_year?, end_year?, include_historical?, include_forecast?

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { validateQuery } from '@/lib/validateRequest';
import { GetSeriesQuerySchema } from '@/lib/schemas/timeseries';

type SeriesRow = {
  year: number;
  value: number | null;
  is_historical: boolean;
};

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  
  // Validate query params using helper
  const validation = validateQuery(GetSeriesQuerySchema, searchParams);
  if (!validation.success) {
    return validation.response;
  }
  
  const { version_id, metric_key, start_year, end_year, include_historical = true, include_forecast = true } = validation.data;
  
  const supabase = getServiceClient();
  
  // Build query
  let query = supabase
    .from('version_metrics')
    .select('year, value, is_historical')
    .eq('version_id', version_id)
    .eq('metric_key', metric_key);
  
  // Filter by year range if provided
  if (start_year !== undefined) {
    query = query.gte('year', start_year);
  }
  if (end_year !== undefined) {
    query = query.lte('year', end_year);
  }
  
  // Filter by historical/forecast if specified
  if (!include_historical && !include_forecast) {
    // If both are false, return empty array
    return NextResponse.json([]);
  }
  
  if (!include_historical && include_forecast) {
    query = query.eq('is_historical', false);
  } else if (include_historical && !include_forecast) {
    query = query.eq('is_historical', true);
  }
  
  // Order by year ascending
  query = query.order('year', { ascending: true });
  
  const { data, error } = await query;
  
  if (error) {
    logger.error('Series fetch error', error, { version_id, metric_key });
    return createErrorResponse('Failed to fetch series data', 500);
  }
  
  // Transform to SeriesPoint format
  const series = (data || []).map((row: SeriesRow) => ({
    year: row.year,
    value: row.value,
    isHistorical: row.is_historical,
  }));
  
  logger.info('Series fetched successfully', { 
    version_id, 
    metric_key, 
    count: series.length,
    years: series.map(s => s.year),
  });
  
  return NextResponse.json(series);
});
