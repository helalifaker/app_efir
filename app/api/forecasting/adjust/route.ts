import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabaseServer';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { z } from 'zod';

const ForecastAdjustmentSchema = z.object({
  driver_id: z.string().uuid(),
  scenario_id: z.string().uuid(),
  year_range: z.object({
    start: z.number().int().min(2023),
    end: z.number().int().max(2052),
  }),
  adjustment_type: z.enum([
    'percentage',
    'absolute',
    'smoothing',
    'seasonality',
    'step_change',
  ]),
  adjustment_config: z.record(z.string(), z.unknown()),
});

interface DriverValue {
  year: number;
  value: number;
}

/**
 * POST /api/forecasting/adjust
 * Apply adjustments to forecast values
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();

  const validation = ForecastAdjustmentSchema.safeParse(body);
  if (!validation.success) {
    return createErrorResponse(
      'Invalid adjustment request',
      400,
      validation.error.issues
    );
  }

  const { driver_id, scenario_id, year_range, adjustment_type, adjustment_config } =
    validation.data;

  const supabase = getServiceClient();

  // Get existing values
  const { data: existingValues, error } = await supabase
    .from('driver_values')
    .select('year, value')
    .eq('driver_id', driver_id)
    .eq('scenario_id', scenario_id)
    .gte('year', year_range.start)
    .lte('year', year_range.end)
    .order('year', { ascending: true });

  if (error || !existingValues || existingValues.length === 0) {
    return createErrorResponse('No forecast values found to adjust', 404);
  }

  const values = existingValues as DriverValue[];

  // Apply adjustment based on type
  let adjustedValues: Array<{ year: number; value: number }>;

  switch (adjustment_type) {
    case 'percentage':
      adjustedValues = applyPercentageAdjustment(values, adjustment_config);
      break;
    case 'absolute':
      adjustedValues = applyAbsoluteAdjustment(values, adjustment_config);
      break;
    case 'smoothing':
      adjustedValues = applySmoothing(values, adjustment_config);
      break;
    case 'seasonality':
      adjustedValues = applySeasonality(values, adjustment_config);
      break;
    case 'step_change':
      adjustedValues = applyStepChange(values, adjustment_config);
      break;
    default:
      adjustedValues = values;
  }

  // Save adjusted values
  const valuesToUpsert = adjustedValues.map((v) => ({
    driver_id,
    scenario_id,
    year: v.year,
    value: v.value,
    source: 'adjusted',
    notes: `Adjusted using ${adjustment_type}`,
  }));

  const { data: savedValues, error: saveError } = await supabase
    .from('driver_values')
    .upsert(valuesToUpsert, {
      onConflict: 'driver_id,scenario_id,year',
      ignoreDuplicates: false,
    })
    .select();

  if (saveError) {
    console.error('Error saving adjusted values:', saveError);
    return createErrorResponse('Failed to save adjusted values', 500);
  }

  return NextResponse.json({
    driver_id,
    scenario_id,
    adjustment_type,
    original_values: values,
    adjusted_values: adjustedValues,
    saved_count: savedValues?.length || 0,
  });
});

/**
 * Apply percentage adjustment to values
 */
function applyPercentageAdjustment(
  values: DriverValue[],
  config: Record<string, unknown>
): Array<{ year: number; value: number }> {
  const percentage = (config.percentage as number) || 0;

  return values.map((v) => ({
    year: v.year,
    value: v.value * (1 + percentage / 100),
  }));
}

/**
 * Apply absolute adjustment to values
 */
function applyAbsoluteAdjustment(
  values: DriverValue[],
  config: Record<string, unknown>
): Array<{ year: number; value: number }> {
  const amount = (config.amount as number) || 0;

  return values.map((v) => ({
    year: v.year,
    value: v.value + amount,
  }));
}

/**
 * Apply smoothing to values (moving average)
 */
function applySmoothing(
  values: DriverValue[],
  config: Record<string, unknown>
): Array<{ year: number; value: number }> {
  const window = (config.window as number) || 3;

  const smoothed = [];

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(values.length, i + Math.ceil(window / 2));
    const windowValues = values.slice(start, end);

    const avg =
      windowValues.reduce((sum, v) => sum + v.value, 0) / windowValues.length;

    smoothed.push({
      year: values[i].year,
      value: avg,
    });
  }

  return smoothed;
}

/**
 * Apply seasonality pattern to values
 */
function applySeasonality(
  values: DriverValue[],
  config: Record<string, unknown>
): Array<{ year: number; value: number }> {
  const pattern = (config.pattern as number[]) || [1, 1, 1, 1];
  const amplitude = (config.amplitude as number) || 0.1;

  return values.map((v, i) => {
    const seasonalIndex = i % pattern.length;
    const seasonalFactor = 1 + (pattern[seasonalIndex] - 1) * amplitude;

    return {
      year: v.year,
      value: v.value * seasonalFactor,
    };
  });
}

/**
 * Apply step change to values
 */
function applyStepChange(
  values: DriverValue[],
  config: Record<string, unknown>
): Array<{ year: number; value: number }> {
  const changeYear = (config.change_year as number) || values[0].year;
  const changeAmount = (config.change_amount as number) || 0;
  const changeType = (config.change_type as string) || 'absolute'; // absolute or percentage

  return values.map((v) => {
    if (v.year < changeYear) {
      return v;
    }

    const adjustedValue =
      changeType === 'percentage'
        ? v.value * (1 + changeAmount / 100)
        : v.value + changeAmount;

    return {
      year: v.year,
      value: adjustedValue,
    };
  });
}
