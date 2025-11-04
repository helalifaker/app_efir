// app/api/versions/list/route.ts
// Versions list API with filtering and pagination
// GET /api/versions/list?status=Ready&model_id=UUID&limit=50&offset=0

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { validateQuery } from '@/lib/validateRequest';
import { DEFAULT_LIMIT, DEFAULT_OFFSET, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from '@/lib/constants';
import { z } from 'zod';

const VersionsListQuerySchema = z.object({
  status: z.enum(['Draft', 'Ready', 'Locked', 'Archived']).optional(),
  model_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(MIN_PAGE_SIZE).max(MAX_PAGE_SIZE).optional().default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).optional().default(DEFAULT_OFFSET),
  search: z.string().optional(), // Search by version name
  sort_by: z.enum(['name', 'created_at', 'updated_at', 'status']).optional().default('created_at'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
});

type VersionRow = {
  id: string;
  name: string;
  status: string;
  model_id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  models: {
    id: string;
    name: string;
  }[] | null;
};

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  
  // Validate query params using helper
  const validation = validateQuery(VersionsListQuerySchema, searchParams);
  if (!validation.success) {
    return validation.response;
  }
  
  const { status: statusParam, model_id: modelIdParam, limit: limitParam, offset: offsetParam, search: searchParam, sort_by: sortByParam, sort_order: sortOrderParam } = validation.data;
  
  const supabase = getServiceClient();
  
  // Build version query
  let versionQuery = supabase
    .from('model_versions')
    .select('id, name, status, model_id, created_at, updated_at, created_by, models(id, name)', {
      count: 'exact',
    });
  
  // Apply filters
  if (statusParam) {
    versionQuery = versionQuery.eq('status', statusParam);
  }
  
  if (modelIdParam) {
    versionQuery = versionQuery.eq('model_id', modelIdParam);
  }
  
  if (searchParam) {
    versionQuery = versionQuery.ilike('name', `%${searchParam}%`);
  }
  
  // Apply sorting
  versionQuery = versionQuery.order(sortByParam, { ascending: sortOrderParam === 'asc' });
  
  // Apply pagination
  versionQuery = versionQuery.range(offsetParam, offsetParam + limitParam - 1);
  
  const { data: versions, error: versionsError, count } = await versionQuery;
  
  if (versionsError) {
    logger.error('Versions list query error', versionsError);
    return createErrorResponse('Failed to fetch versions', 500);
  }
  
  // Format versions
  const formattedVersions = (versions || []).map((v: VersionRow) => ({
    id: v.id,
    name: v.name,
    status: v.status,
    model_id: v.model_id,
    model_name: v.models?.[0]?.name || 'Unknown Model',
    created_at: v.created_at,
    updated_at: v.updated_at,
    created_by: v.created_by,
  }));
  
  // Get total count for pagination
  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / limitParam);
  const currentPage = Math.floor(offsetParam / limitParam) + 1;
  
  logger.info('Versions list fetched successfully', {
    count: formattedVersions.length,
    total: totalCount,
    filters: { status: statusParam, model_id: modelIdParam, search: searchParam },
  });
  
  return NextResponse.json({
    versions: formattedVersions,
    pagination: {
      total: totalCount,
      limit: limitParam,
      offset: offsetParam,
      currentPage,
      totalPages,
      hasNext: offsetParam + limitParam < totalCount,
      hasPrevious: offsetParam > 0,
    },
  });
});

