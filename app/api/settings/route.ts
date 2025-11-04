import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceClient } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { DEFAULT_SETTINGS, mergeSettings } from '@/lib/getSettings';

const SettingsSchema = z.object({
  vat: z.object({ rate: z.number().min(0).max(1) }).optional(),
  numberFormat: z
    .object({
      locale: z.enum(['en-US', 'ar-SA']),
      decimals: z.union([z.literal(0), z.literal(2)]),
      compact: z.boolean(),
    })
    .optional(),
  validation: z
    .object({
      requireTabs: z.array(z.string()),
      bsTolerance: z.number().min(0),
    })
    .optional(),
  ui: z
    .object({
      currency: z.string(),
      theme: z.enum(['system', 'light', 'dark']),
    })
    .optional(),
}).catchall(z.unknown()); // Allow unknown keys

/**
 * GET /api/settings
 * Returns all app settings with defaults applied
 */
export const GET = withErrorHandler(async () => {
  const supabase = getServiceClient();

  const { data, error } = await supabase.from('app_settings').select('key, value');

  if (error) {
    logger.error('Settings GET error', error, { operation: 'fetch_settings' });
    return createErrorResponse('Failed to fetch settings', 500);
  }

  // Use the shared merge function for type-safe merging
  const settings = mergeSettings(DEFAULT_SETTINGS, data || []);

  logger.info('Settings fetched successfully', { keys: Object.keys(settings) });
  return NextResponse.json(settings);
});

/**
 * PATCH /api/settings
 * Updates specific settings by key
 */
export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();

  // Validate the request body
  let validated;
  try {
    validated = SettingsSchema.parse(body);
  } catch (e) {
    if (e instanceof z.ZodError) {
      logger.warn('Settings validation error', { errors: e.issues });
      return createErrorResponse('Invalid request', 400, e.issues);
    }
    throw e;
  }

  const supabase = getServiceClient();

  // Update each key
  const updates = Object.entries(validated).map(async ([key, value]) => {
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        {
          key,
          value: value as unknown, // JSONB accepts any JSON-serializable value
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );

    if (error) {
      logger.error(`Settings update error for key ${key}`, error, { key });
      throw error;
    }
  });

  await Promise.all(updates);

  logger.info('Settings updated successfully', { keys: Object.keys(validated) });
  return NextResponse.json({ ok: true });
});
