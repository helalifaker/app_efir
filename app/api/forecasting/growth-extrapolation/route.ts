import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabaseServer';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { GrowthExtrapolationSchema } from '@/lib/schemas/planner';

interface DataPoint {
  year: number;
  value: number;
}

/**
 * POST /api/forecasting/growth-extrapolation
 * Extrapolate future values based on growth rates
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();

  const validation = GrowthExtrapolationSchema.safeParse(body);
  if (!validation.success) {
    return createErrorResponse(
      'Invalid growth extrapolation request',
      400,
      validation.error.issues
    );
  }

  const {
    driver_id,
    scenario_id,
    base_year,
    forecast_years,
    growth_rate,
    growth_rate_decline,
    floor_value,
    ceiling_value,
  } = validation.data;

  const supabase = getServiceClient();

  // Get base year value
  const { data: baseData, error } = await supabase
    .from('driver_values')
    .select('value')
    .eq('driver_id', driver_id)
    .eq('scenario_id', scenario_id)
    .eq('year', base_year)
    .single();

  if (error || !baseData) {
    return createErrorResponse(
      `No data found for base year ${base_year}`,
      404
    );
  }

  const baseValue = baseData.value;

  // Calculate forecast values
  const forecast = [];
  let currentValue = baseValue;
  let currentGrowthRate = growth_rate;

  for (let year = forecast_years.start; year <= forecast_years.end; year++) {
    // Apply growth rate
    currentValue = currentValue * (1 + currentGrowthRate / 100);

    // Apply floor and ceiling constraints
    if (floor_value !== undefined && currentValue < floor_value) {
      currentValue = floor_value;
    }
    if (ceiling_value !== undefined && currentValue > ceiling_value) {
      currentValue = ceiling_value;
    }

    forecast.push({
      year,
      value: currentValue,
      growth_rate: currentGrowthRate,
    });

    // Apply growth rate decline if specified
    if (growth_rate_decline) {
      currentGrowthRate = Math.max(
        growth_rate_decline.terminal_rate,
        currentGrowthRate - growth_rate_decline.annual_decline
      );
    }
  }

  // Calculate summary statistics
  const finalValue = forecast[forecast.length - 1].value;
  const totalGrowth = ((finalValue - baseValue) / baseValue) * 100;
  const years = forecast.length;
  const cagr = years > 0 ? (Math.pow(finalValue / baseValue, 1 / years) - 1) * 100 : 0;

  return NextResponse.json({
    driver_id,
    scenario_id,
    base_year,
    base_value: baseValue,
    forecast,
    summary: {
      final_value: finalValue,
      total_growth_percent: totalGrowth,
      cagr_percent: cagr,
      years_forecasted: years,
    },
  });
});
