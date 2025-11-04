// app/api/versions/[id]/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UuidSchema, validateQuery } from "@/lib/validateRequest";
import { logger } from "@/lib/logger";
import { withErrorHandler } from "@/lib/withErrorHandler";
import { getServiceClient } from "@/lib/supabaseServer";
import { verifyVersionOwnership, getCurrentUserId } from "@/lib/ownership";

const QuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(100)).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(0)).optional(),
});

export const GET = withErrorHandler(async (
  req: NextRequest,
  ctx?: { params?: Promise<Record<string, string>> }
) => {
  if (!ctx?.params) {
    return NextResponse.json({ error: 'Missing route parameters' }, { status: 400 });
  }
  const params = await ctx.params;
  const { id } = params as { id: string };
  
  // Validate UUID
  const uuidValidation = UuidSchema.safeParse(id);
  if (!uuidValidation.success) {
    return NextResponse.json(
      {
        error: 'Invalid version ID format',
        details: [{ path: 'id', message: 'Must be a valid UUID', code: 'invalid_type' }],
      },
      { status: 400 }
    );
  }

  // Parse and validate query parameters
  const { searchParams } = new URL(req.url);
  const queryValidation = validateQuery(QuerySchema, searchParams);
  if (!queryValidation.success) {
    return queryValidation.response;
  }
  const { limit = 50, offset = 0 } = queryValidation.data;

  // Verify ownership
  const userId = await getCurrentUserId();
  const ownershipCheck = await verifyVersionOwnership(id, userId);
  if (!ownershipCheck.owned) {
    return ownershipCheck.error || NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getServiceClient();

  // Build query with pagination
  const query = supabase
    .from("version_status_history")
    .select("id, old_status, new_status, changed_by, note, changed_at", { count: 'exact' })
    .eq("version_id", id)
    .order("changed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: items, error, count } = await query;

  if (error) {
    logger.error("History fetch error", error, { versionId: id });
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  logger.info('History fetched successfully', { 
    versionId: id, 
    itemCount: items?.length || 0,
    totalCount: count,
    limit,
    offset,
  });

  return NextResponse.json({ 
    items: items || [],
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: count ? offset + limit < count : false,
    },
  });
});
