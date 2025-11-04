// app/api/version-tabs/[id]/[tab]/route.ts
// GET and PATCH endpoints for version tab data with schema validation

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UuidSchema } from '@/lib/validateRequest';
import { validateTabData, TabType } from '@/lib/schemas/tabs';
import { derivePnl, deriveBs, deriveCf } from '@/lib/derive';
import { logger } from '@/lib/logger';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { runCashEngineForVersion } from '@/lib/engine/cashEngineService';
import { getServiceClient } from '@/lib/supabaseServer';
import { verifyVersionOwnership, getCurrentUserId } from '@/lib/ownership';

// PATCH body schema
const PatchTabSchema = z.object({
  data: z.record(z.string(), z.any()), // Allow any JSONB structure
});

export const GET = withErrorHandler(async (
  _: Request,
  ctx?: { params?: Promise<Record<string, string>> }
) => {
  if (!ctx?.params) {
    return NextResponse.json({ error: 'Missing route parameters' }, { status: 400 });
  }
  const params = await ctx.params;
  const { id, tab } = params as { id: string; tab: string };

  // Validate UUID
  const uuidValidation = UuidSchema.safeParse(id);
  if (!uuidValidation.success) {
    return NextResponse.json(
      { error: 'Invalid version ID format' },
      { status: 400 }
    );
  }

  // Validate tab type
  const validTabs: TabType[] = ['assumptions', 'overview', 'pnl', 'bs', 'cf', 'capex', 'validation'];
  if (!validTabs.includes(tab as TabType)) {
    return NextResponse.json(
      { error: `Invalid tab type. Must be one of: ${validTabs.join(', ')}` },
      { status: 400 }
    );
  }

  // Verify ownership
  const userId = await getCurrentUserId();
  const ownershipCheck = await verifyVersionOwnership(id, userId);
  if (!ownershipCheck.owned) {
    return ownershipCheck.error || NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getServiceClient();

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
  ctx?: { params?: Promise<Record<string, string>> }
) => {
  if (!ctx?.params) {
    return NextResponse.json({ error: 'Missing route parameters' }, { status: 400 });
  }
  const params = await ctx.params;
  const { id, tab } = params as { id: string; tab: string };

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
  const validTabs: TabType[] = ['assumptions', 'overview', 'pnl', 'bs', 'cf', 'capex', 'validation'];
  if (!validTabs.includes(tab as TabType)) {
    return NextResponse.json(
      { error: `Invalid tab type. Must be one of: ${validTabs.join(', ')}` },
      { status: 400 }
    );
  }

  // Verify ownership
  const userId = await getCurrentUserId();
  const ownershipCheck = await verifyVersionOwnership(id, userId);
  if (!ownershipCheck.owned) {
    return ownershipCheck.error || NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getServiceClient();

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

  // Auto-trigger cash engine if P&L, BS, or CF tab was updated
  // Run asynchronously (don't block response)
  if (['pnl', 'bs', 'cf'].includes(tab)) {
    // Check version status - only run for Draft/Ready (not Locked)
    const { data: version } = await supabase
      .from('model_versions')
      .select('status')
      .eq('id', id)
      .single();

    if (version && version.status !== 'Locked' && version.status !== 'Archived') {
      // Trigger cash engine asynchronously (fire and forget)
      runCashEngineForVersion(id, { forceRecalculation: false }).catch((error) => {
        logger.error('Auto-triggered cash engine failed', error, { versionId: id, tab });
        // Don't throw - this is a background process
      });
    }
  }

  return NextResponse.json({ data: tabRow?.data || {} });
});

