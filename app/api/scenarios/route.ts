// app/api/scenarios/route.ts
// API routes for scenario management

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabaseServer';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { CreateScenarioSchema } from '@/lib/schemas/planner';
import { logger } from '@/lib/logger';

/**
 * GET /api/scenarios
 * List all scenarios for a version or model
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get('version_id');
  const modelId = searchParams.get('model_id');

  if (!versionId && !modelId) {
    return createErrorResponse('Either version_id or model_id is required', 400);
  }

  const supabase = getServiceClient();

  if (versionId) {
    // Get scenarios for a specific version
    const { data, error } = await supabase
      .from('scenarios')
      .select(`
        *,
        version:model_versions!inner(id, name, model_id)
      `)
      .eq('version_id', versionId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Failed to fetch scenarios', error, { versionId });
      return createErrorResponse('Failed to fetch scenarios', 500);
    }

    return NextResponse.json({ scenarios: data });
  } else {
    // Get all scenarios for a model (across all versions)
    const { data, error } = await supabase
      .from('scenarios')
      .select(`
        *,
        version:model_versions!inner(id, name, model_id)
      `)
      .eq('version.model_id', modelId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch scenarios', error, { modelId });
      return createErrorResponse('Failed to fetch scenarios', 500);
    }

    return NextResponse.json({ scenarios: data });
  }
});

/**
 * POST /api/scenarios
 * Create a new scenario
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();

  // Validate request
  const validation = CreateScenarioSchema.safeParse(body);
  if (!validation.success) {
    return createErrorResponse('Invalid request', 400, validation.error.issues);
  }

  const { version_id, name, type, description, parent_scenario_id, copy_data_from } = validation.data;
  const supabase = getServiceClient();

  // Check if version exists
  const { data: version, error: versionError } = await supabase
    .from('model_versions')
    .select('id')
    .eq('id', version_id)
    .single();

  if (versionError || !version) {
    return createErrorResponse('Version not found', 404);
  }

  // Create scenario
  const { data: scenario, error: scenarioError } = await supabase
    .from('scenarios')
    .insert({
      version_id,
      name,
      type,
      description,
      parent_scenario_id,
      assumptions: {},
    })
    .select()
    .single();

  if (scenarioError) {
    logger.error('Failed to create scenario', scenarioError, { version_id, name });
    return createErrorResponse('Failed to create scenario', 500);
  }

  // Copy data from another scenario if requested
  if (copy_data_from) {
    try {
      // Copy version_tabs
      const { data: tabsToCopy, error: fetchError } = await supabase
        .from('version_tabs')
        .select('*')
        .eq('version_id', version_id)
        .eq('scenario_id', copy_data_from);

      if (fetchError) throw fetchError;

      if (tabsToCopy && tabsToCopy.length > 0) {
        const newTabs = tabsToCopy.map((tab: { tab: string; data: unknown }) => ({
          version_id,
          scenario_id: scenario.id,
          tab: tab.tab,
          data: tab.data,
        }));

        const { error: insertError } = await supabase
          .from('version_tabs')
          .insert(newTabs);

        if (insertError) throw insertError;
      }

      logger.info('Scenario created with copied data', {
        scenario_id: scenario.id,
        copied_from: copy_data_from,
        tabs_copied: tabsToCopy?.length || 0,
      });
    } catch (error) {
      logger.error('Failed to copy scenario data', error, {
        scenario_id: scenario.id,
        copy_data_from,
      });
      // Don't fail the request, scenario was created successfully
    }
  }

  return NextResponse.json(scenario, { status: 201 });
});
