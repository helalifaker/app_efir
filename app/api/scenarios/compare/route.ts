// app/api/scenarios/compare/route.ts
// Compare multiple scenarios side-by-side

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { CompareScenariosSchema } from '@/lib/schemas/planner';
import { logger } from '@/lib/logger';

/**
 * POST /api/scenarios/compare
 * Compare multiple scenarios with their data
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();

  // Validate request
  const validation = CompareScenariosSchema.safeParse(body);
  if (!validation.success) {
    return createErrorResponse('Invalid request', 400, validation.error.issues);
  }

  const { version_id, scenario_ids, metrics, years } = validation.data;
  const supabase = getServiceClient();

  // Verify all scenarios belong to the same version
  const { data: scenarios, error: scenariosError } = await supabase
    .from('scenarios')
    .select('*')
    .in('id', scenario_ids)
    .eq('version_id', version_id);

  if (scenariosError || !scenarios || scenarios.length !== scenario_ids.length) {
    return createErrorResponse('One or more scenarios not found', 404);
  }

  // Get tabs for all scenarios
  const { data: tabs, error: tabsError } = await supabase
    .from('version_tabs')
    .select('*')
    .eq('version_id', version_id)
    .in('scenario_id', scenario_ids);

  if (tabsError) {
    logger.error('Failed to fetch scenario tabs', tabsError, { version_id, scenario_ids });
    return createErrorResponse('Failed to fetch scenario data', 500);
  }

  // Get driver values for all scenarios
  const { data: driverValues, error: driverError } = await supabase
    .from('driver_values')
    .select(`
      *,
      driver:drivers(id, name, display_name, category, unit)
    `)
    .in('scenario_id', scenario_ids);

  if (driverError) {
    logger.error('Failed to fetch driver values', driverError, { scenario_ids });
  }

  // Organize data by scenario
  const comparisonData = scenario_ids.map((scenarioId) => {
    const scenario = scenarios.find((s) => s.id === scenarioId);
    const scenarioTabs = tabs?.filter((t) => t.scenario_id === scenarioId) || [];
    const scenarioDrivers = driverValues?.filter((dv) => dv.scenario_id === scenarioId) || [];

    // Extract metrics from tabs if specific metrics requested
    let metricsData: Record<string, unknown> = {};
    if (metrics && metrics.length > 0) {
      scenarioTabs.forEach((tab) => {
        if (tab.data && typeof tab.data === 'object') {
          metrics.forEach((metricKey) => {
            if (metricKey in tab.data) {
              metricsData[metricKey] = (tab.data as Record<string, unknown>)[metricKey];
            }
          });
        }
      });
    }

    // Filter driver values by years if specified
    let filteredDrivers = scenarioDrivers;
    if (years && years.length > 0) {
      filteredDrivers = scenarioDrivers.filter((dv) => years.includes(dv.year));
    }

    return {
      scenario: {
        id: scenario?.id,
        name: scenario?.name,
        type: scenario?.type,
        description: scenario?.description,
      },
      tabs: scenarioTabs.map((t) => ({
        tab: t.tab,
        data: t.data,
      })),
      drivers: filteredDrivers.map((dv) => ({
        driver_id: dv.driver_id,
        driver_name: dv.driver?.display_name || dv.driver?.name,
        category: dv.driver?.category,
        unit: dv.driver?.unit,
        year: dv.year,
        value: dv.value,
        source: dv.source,
      })),
      metrics: metricsData,
    };
  });

  // Calculate deltas between scenarios
  const deltas: Record<string, unknown>[] = [];
  if (scenario_ids.length === 2 && metrics && metrics.length > 0) {
    const base = comparisonData[0].metrics;
    const compare = comparisonData[1].metrics;

    metrics.forEach((metricKey) => {
      const baseValue = base[metricKey] as number;
      const compareValue = compare[metricKey] as number;

      if (typeof baseValue === 'number' && typeof compareValue === 'number') {
        deltas.push({
          metric: metricKey,
          base_value: baseValue,
          compare_value: compareValue,
          delta: compareValue - baseValue,
          delta_pct: baseValue !== 0 ? ((compareValue - baseValue) / baseValue) * 100 : null,
        });
      }
    });
  }

  logger.info('Scenarios compared', { version_id, scenario_count: scenario_ids.length });

  return NextResponse.json({
    version_id,
    scenarios: comparisonData,
    deltas: deltas.length > 0 ? deltas : undefined,
  });
});
