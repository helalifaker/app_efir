// app/api/timeseries/metrics/route.ts
// PATCH batch update metrics for a version
// Body: { version_id, metrics: [{ year, metric_key, value }] }

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabaseServer';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { BatchMetricUpdateSchema } from '@/lib/schemas/timeseries';
import { HISTORY_YEARS } from '@/types';

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  
  // Validate request body
  const validation = BatchMetricUpdateSchema.safeParse(body);
  if (!validation.success) {
    logger.warn('Invalid batch metric update', { errors: validation.error.issues });
    return createErrorResponse('Invalid request body', 400, validation.error.issues);
  }
  
  const { version_id, metrics } = validation.data;
  
  const supabase = getServiceClient();
  
  // Verify version exists
  const { data: version, error: versionError } = await supabase
    .from('model_versions')
    .select('id, status')
    .eq('id', version_id)
    .single();
  
  if (versionError || !version) {
    logger.error('Version not found for metric update', versionError, { version_id });
    return createErrorResponse('Version not found', 404);
  }
  
  // Prevent updates to locked versions (unless admin)
  if (version.status === 'Locked') { // Blueprint: capitalized status
    // Check if user is admin
    const serverSupabase = await createServerClient();
    const { data: { user }, error: authError } = await serverSupabase.auth.getUser();
    
    if (authError || !user || !isAdmin(user)) {
      logger.warn('Attempted to update metrics for locked version', { 
        version_id, 
        userId: user?.id,
        isAdmin: user ? isAdmin(user) : false 
      });
      return createErrorResponse('Cannot update metrics for locked versions. Admin access required.', 403);
    }
    
    // Admin can update locked versions - log it
    logger.info('Admin updating metrics for locked version', { 
      version_id, 
      userId: user.id,
      email: user.email 
    });
  }
  
  // Prepare metrics for upsert
  // Determine is_historical based on year (2023-2024 are historical)
  const metricsToUpsert = metrics.map((m) => ({
    version_id,
    year: m.year,
    metric_key: m.metric_key,
    value: m.value,
    is_historical: (HISTORY_YEARS as readonly number[]).includes(m.year),
  }));
  
  // Batch upsert (use onConflict to handle duplicates)
  // Note: Supabase doesn't support true transactions in upsert, but we can do multiple upserts
  // For better performance, we'll do one upsert with all metrics
  const { error: upsertError } = await supabase
    .from('version_metrics')
    .upsert(metricsToUpsert, {
      onConflict: 'version_id,year,metric_key',
    });
  
  if (upsertError) {
    logger.error('Metric upsert error', upsertError, { version_id, count: metricsToUpsert.length });
    return createErrorResponse('Failed to update metrics', 500);
  }
  
  // Mark historical years as read-only (if any were updated)
  const hasHistorical = metricsToUpsert.some((m) => m.is_historical);
  if (hasHistorical) {
    // Update is_historical flag for 2023-2024 years to ensure they're marked correctly
    const { error: historicalError } = await supabase.rpc('mark_historical_years', {
      version_id_param: version_id,
    });
    
    if (historicalError) {
      logger.warn('Failed to mark historical years', { version_id, error: historicalError });
      // Don't fail the request, just log the warning
    }
  }
  
  logger.info('Metrics updated successfully', { 
    version_id, 
    count: metricsToUpsert.length,
    metricKeys: [...new Set(metricsToUpsert.map(m => m.metric_key))],
  });
  
  return NextResponse.json({ 
    ok: true, 
    updated: metricsToUpsert.length,
  });
});
