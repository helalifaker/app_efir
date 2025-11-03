// app/api/version-tabs/[id]/[tab]/route.ts
// GET and PATCH endpoints for version tab data with schema validation

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { UuidSchema } from '@/lib/validateRequest';
import { validateTabData, TabType } from '@/lib/schemas/tabs';
import { derivePnl, deriveBs, deriveCf } from '@/lib/derive';
import { logger } from '@/lib/logger';
import { withErrorHandler } from '@/lib/withErrorHandler';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
);

// PATCH body schema
const PatchTabSchema = z.object({
  data: z.record(z.string(), z.any()), // Allow any JSONB structure
});

export const GET = withErrorHandler(async (
  _: Request,
  ctx: { params: Promise<{ id: string; tab: string }> }
) => {
  const { id, tab } = await ctx.params;

  // Validate UUID
  const uuidValidation = UuidSchema.safeParse(id);
  if (!uuidValidation.success) {
    return NextResponse.json(
      { error: 'Invalid version ID format' },
      { status: 400 }
    );
  }

  // Validate tab type
  const validTabs: TabType[] = ['overview', 'pnl', 'bs', 'cf', 'capex', 'controls'];
  if (!validTabs.includes(tab as TabType)) {
    return NextResponse.json(
      { error: `Invalid tab type. Must be one of: ${validTabs.join(', ')}` },
      { status: 400 }
    );
  }

  // Fetch tab data
  const { data: tabRow, error } = await supabase
    .from('version_tabs')
    .select('data')
    .eq('version_id', id)
    .eq('tab', tab)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found - return empty object
      return NextResponse.json({ data: {} });
    }
    logger.error('GET tab error', error, { versionId: id, tab });
    return NextResponse.json(
      { error: `Failed to fetch tab: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: tabRow?.data || {} });
});

export const PATCH = withErrorHandler(async (
  req: Request,
  ctx: { params: Promise<{ id: string; tab: string }> }
) => {
  const { id, tab } = await ctx.params;

  // Validate UUID
  const uuidValidation = UuidSchema.safeParse(id);
  if (!uuidValidation.success) {
    return NextResponse.json(
      { 
        error: 'Invalid version ID format', 
        details: uuidValidation.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        }))
      },
      { status: 400 }
    );
  }

  // Validate tab type
  const validTabs: TabType[] = ['overview', 'pnl', 'bs', 'cf', 'capex', 'controls'];
  if (!validTabs.includes(tab as TabType)) {
    return NextResponse.json(
      { error: `Invalid tab type. Must be one of: ${validTabs.join(', ')}` },
      { status: 400 }
    );
  }

  // Parse and validate body
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const bodyValidation = PatchTabSchema.safeParse(body);
  if (!bodyValidation.success) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        details: bodyValidation.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
      { status: 400 }
    );
  }

  // Validate tab data against schema
  const schemaValidation = validateTabData(tab as TabType, bodyValidation.data.data);
  if (!schemaValidation.success && schemaValidation.error) {
    return NextResponse.json(
      {
        error: 'Tab data validation failed',
        details: schemaValidation.error.issues.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
      },
      { status: 400 }
    );
  }

  // Apply derivations based on tab type
  let finalData = bodyValidation.data.data;
  if (tab === 'pnl') {
    finalData = { ...finalData, ...derivePnl(finalData) };
  } else if (tab === 'bs') {
    finalData = { ...finalData, ...deriveBs(finalData) };
  } else if (tab === 'cf') {
    finalData = { ...finalData, ...deriveCf(finalData) };
  }

  // Upsert tab data
  const { data: tabRow, error } = await supabase
    .from('version_tabs')
    .upsert({
      version_id: id,
      tab,
      data: finalData,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'version_id,tab',
    })
    .select('data')
    .single();

  if (error) {
    logger.error('PATCH tab error', error, { versionId: id, tab });
    return NextResponse.json(
      { error: `Failed to update tab: ${error.message}` },
      { status: 500 }
    );
  }

  logger.info('Tab updated', { versionId: id, tab });
  return NextResponse.json({ data: tabRow?.data || {} });
});

