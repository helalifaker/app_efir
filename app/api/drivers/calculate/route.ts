import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabaseServer';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { z } from 'zod';

const CalculateDriverSchema = z.object({
  scenario_id: z.string().uuid(),
  driver_id: z.string().uuid().optional(),
  year_range: z.object({
    start: z.number().int().min(2023),
    end: z.number().int().max(2052),
  }),
});

interface DriverData {
  id: string;
  name: string;
  formula?: string;
  dependencies?: string[];
  data_type: string;
  category: string;
}

interface DriverValue {
  driver_id: string;
  year: number;
  value: number;
}

/**
 * POST /api/drivers/calculate
 * Calculate driver values based on formulas and dependencies
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();

  const validation = CalculateDriverSchema.safeParse(body);
  if (!validation.success) {
    return createErrorResponse(
      'Invalid calculation request',
      400,
      validation.error.issues
    );
  }

  const { scenario_id, driver_id, year_range } = validation.data;
  const supabase = getServiceClient();

  // Verify scenario exists
  const { data: scenario } = await supabase
    .from('scenarios')
    .select('id')
    .eq('id', scenario_id)
    .single();

  if (!scenario) {
    return createErrorResponse('Scenario not found', 404);
  }

  // Get drivers to calculate
  let driversQuery = supabase
    .from('drivers')
    .select('*')
    .eq('scenario_id', scenario_id);

  if (driver_id) {
    driversQuery = driversQuery.eq('id', driver_id);
  }

  const { data: drivers, error: driversError } = await driversQuery;

  if (driversError || !drivers || drivers.length === 0) {
    return createErrorResponse('No drivers found to calculate', 404);
  }

  // Get existing driver values for the scenario
  const { data: existingValues } = await supabase
    .from('driver_values')
    .select('*')
    .eq('scenario_id', scenario_id)
    .gte('year', year_range.start)
    .lte('year', year_range.end);

  // Build value lookup map
  const valueMap = new Map<string, number>();
  existingValues?.forEach((v: DriverValue) => {
    valueMap.set(`${v.driver_id}_${v.year}`, v.value);
  });

  // Build driver lookup map
  const driverMap = new Map<string, DriverData>();
  drivers.forEach((d: DriverData) => {
    driverMap.set(d.id, d);
  });

  // Topologically sort drivers based on dependencies
  const sortedDrivers = topologicalSort(drivers as DriverData[]);

  if (!sortedDrivers) {
    return createErrorResponse(
      'Circular dependency detected in driver formulas',
      400
    );
  }

  const calculatedValues: Array<{
    driver_id: string;
    scenario_id: string;
    year: number;
    value: number;
    source: string;
  }> = [];

  // Calculate each driver
  for (const driver of sortedDrivers) {
    if (!driver.formula) {
      continue; // Skip drivers without formulas
    }

    for (let year = year_range.start; year <= year_range.end; year++) {
      try {
        const value = evaluateFormula(
          driver.formula,
          driver.dependencies || [],
          year,
          valueMap,
          driverMap
        );

        if (value !== null && !isNaN(value)) {
          calculatedValues.push({
            driver_id: driver.id,
            scenario_id,
            year,
            value,
            source: 'calculated',
          });

          // Update value map for dependent calculations
          valueMap.set(`${driver.id}_${year}`, value);
        }
      } catch (error) {
        console.error(`Error calculating driver ${driver.name} for year ${year}:`, error);
      }
    }
  }

  // Bulk insert calculated values
  if (calculatedValues.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('driver_values')
      .upsert(calculatedValues, {
        onConflict: 'driver_id,scenario_id,year',
        ignoreDuplicates: false,
      })
      .select();

    if (insertError) {
      console.error('Error saving calculated values:', insertError);
      return createErrorResponse('Failed to save calculated values', 500);
    }

    return NextResponse.json({
      message: `Calculated ${inserted?.length || 0} driver values`,
      values: inserted,
    });
  }

  return NextResponse.json({
    message: 'No values calculated',
    values: [],
  });
});

/**
 * Topologically sort drivers based on dependencies
 */
function topologicalSort(drivers: DriverData[]): DriverData[] | null {
  const sorted: DriverData[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (driverId: string): boolean => {
    if (visited.has(driverId)) return true;
    if (visiting.has(driverId)) return false; // Circular dependency

    visiting.add(driverId);

    const driver = drivers.find((d) => d.id === driverId);
    if (driver && driver.dependencies) {
      for (const depId of driver.dependencies) {
        if (!visit(depId)) return false;
      }
    }

    visiting.delete(driverId);
    visited.add(driverId);
    if (driver) sorted.push(driver);

    return true;
  };

  for (const driver of drivers) {
    if (!visit(driver.id)) {
      return null; // Circular dependency detected
    }
  }

  return sorted;
}

/**
 * Evaluate a driver formula
 * Supports basic arithmetic and references to other drivers
 */
function evaluateFormula(
  formula: string,
  dependencies: string[],
  year: number,
  valueMap: Map<string, number>,
  driverMap: Map<string, DriverData>
): number {
  let expression = formula;

  // Replace driver references with actual values
  for (const depId of dependencies) {
    const driver = driverMap.get(depId);
    if (!driver) continue;

    const value = valueMap.get(`${depId}_${year}`);
    if (value === undefined) {
      throw new Error(`Missing value for driver ${driver.name} in year ${year}`);
    }

    // Replace driver name references in formula
    const driverNamePattern = new RegExp(`\\b${escapeRegExp(driver.name)}\\b`, 'g');
    expression = expression.replace(driverNamePattern, value.toString());
  }

  // Support for special functions
  expression = expression.replace(/PREV_YEAR/g, (year - 1).toString());
  expression = expression.replace(/CURRENT_YEAR/g, year.toString());

  // Evaluate the expression safely
  try {
    // Use Function constructor for safe evaluation (more secure than eval)
    const result = new Function(`return ${expression}`)();
    return typeof result === 'number' ? result : parseFloat(result);
  } catch (error) {
    throw new Error(`Failed to evaluate formula: ${formula}`);
  }
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
