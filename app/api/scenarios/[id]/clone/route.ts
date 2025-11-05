// app/api/scenarios/[id]/clone/route.ts
// Clone a scenario with all its data

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceClient } from '@/lib/supabase/server';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { logger } from '@/lib/logger';

const CloneScenarioSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  type: z.enum(['base', 'optimistic', 'pessimistic', 'custom']).default('custom'),
});

/**
 * POST /api/scenarios/[id]/clone
 * Clone a scenario with all its data
 */
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const sourceScenarioId = params.id;
  const body = await request.json();

  // Validate request
  const validation = CloneScenarioSchema.safeParse(body);
  if (!validation.success) {
    return createErrorResponse('Invalid request', 400, validation.error.issues);
  }

  const { name, description, type } = validation.data;
  const supabase = getServiceClient();

  // Get source scenario
  const { data: sourceScenario, error: sourceError } = await supabase
    .from('scenarios')
    .select('*')
    .eq('id', sourceScenarioId)
    .single();

  if (sourceError || !sourceScenario) {
    return createErrorResponse('Source scenario not found', 404);
  }

  // Create new scenario
  const { data: newScenario, error: createError } = await supabase
    .from('scenarios')
    .insert({
      version_id: sourceScenario.version_id,
      name,
      type,
      description,
      parent_scenario_id: sourceScenarioId,
      assumptions: sourceScenario.assumptions,
    })
    .select()
    .single();

  if (createError) {
    logger.error('Failed to create cloned scenario', createError, { sourceScenarioId });
    return createErrorResponse('Failed to clone scenario', 500);
  }

  // Clone version_tabs
  const { data: tabs, error: tabsError } = await supabase
    .from('version_tabs')
    .select('*')
    .eq('version_id', sourceScenario.version_id)
    .eq('scenario_id', sourceScenarioId);

  if (!tabsError && tabs && tabs.length > 0) {
    const newTabs = tabs.map((tab) => ({
      version_id: sourceScenario.version_id,
      scenario_id: newScenario.id,
      tab: tab.tab,
      data: tab.data,
    }));

    await supabase.from('version_tabs').insert(newTabs);
  }

  // Clone driver_values
  const { data: driverValues, error: driverError } = await supabase
    .from('driver_values')
    .select('*')
    .eq('scenario_id', sourceScenarioId);

  if (!driverError && driverValues && driverValues.length > 0) {
    const newDriverValues = driverValues.map((dv) => ({
      driver_id: dv.driver_id,
      scenario_id: newScenario.id,
      year: dv.year,
      value: dv.value,
      source: dv.source,
      notes: dv.notes,
    }));

    await supabase.from('driver_values').insert(newDriverValues);
  }

  logger.info('Scenario cloned successfully', {
    sourceScenarioId,
    newScenarioId: newScenario.id,
    tabsCloned: tabs?.length || 0,
    driversCloned: driverValues?.length || 0,
  });

  return NextResponse.json(newScenario, { status: 201 });
});
