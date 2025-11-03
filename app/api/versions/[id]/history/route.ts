// app/api/versions/[id]/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { UuidSchema, validateQuery } from "@/lib/validateRequest";
import { logger } from "@/lib/logger";
import { withErrorHandler } from "@/lib/withErrorHandler";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
);

const QuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(100)).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(0)).optional(),
});

export const GET = withErrorHandler(async (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => {
  const { id } = await ctx.params;
  
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
