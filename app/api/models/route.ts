// app/api/models/route.ts
// Models list API
// GET /api/models

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';

export const GET = withErrorHandler(async () => {
  const supabase = getServiceClient();
  
  const { data: models, error } = await supabase
    .from('models')
    .select('id, name, description, created_at, updated_at')
    .order('name', { ascending: true });
  
  if (error) {
    logger.error('Models query error', error);
    return createErrorResponse('Failed to fetch models', 500);
  }
  
  return NextResponse.json({
    models: models || [],
  });
});

