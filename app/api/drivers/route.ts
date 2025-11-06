import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabaseServer';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { CreateDriverSchema } from '@/lib/schemas/planner';

/**
 * GET /api/drivers
 * List all drivers for a scenario
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const scenarioId = searchParams.get('scenario_id');
  const category = searchParams.get('category');
  const isGlobal = searchParams.get('is_global');

  const supabase = getServiceClient();

  // Build query
  let query = supabase
    .from('drivers')
    .select('*')
    .order('created_at', { ascending: false });

  if (scenarioId) {
    query = query.eq('scenario_id', scenarioId);
  }

  if (category) {
    query = query.eq('category', category);
  }

  if (isGlobal !== null) {
    query = query.eq('is_global', isGlobal === 'true');
  }

  const { data: drivers, error } = await query;

  if (error) {
    console.error('Error fetching drivers:', error);
    return createErrorResponse('Failed to fetch drivers', 500);
  }

  return NextResponse.json(drivers);
});

/**
 * POST /api/drivers
 * Create a new driver
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();

  // Validate request body
  const validation = CreateDriverSchema.safeParse(body);
  if (!validation.success) {
    return createErrorResponse(
      'Invalid driver data',
      400,
      validation.error.issues
    );
  }

  const driverData = validation.data;
  const supabase = getServiceClient();

  // Verify scenario exists
  const { data: scenario } = await supabase
    .from('scenarios')
    .select('id')
    .eq('id', driverData.scenario_id)
    .single();

  if (!scenario) {
    return createErrorResponse('Scenario not found', 404);
  }

  // Check for duplicate driver name in scenario
  const { data: existing } = await supabase
    .from('drivers')
    .select('id')
    .eq('scenario_id', driverData.scenario_id)
    .eq('name', driverData.name)
    .single();

  if (existing) {
    return createErrorResponse(
      'Driver with this name already exists in scenario',
      409
    );
  }

  // Create driver
  const { data: driver, error } = await supabase
    .from('drivers')
    .insert({
      scenario_id: driverData.scenario_id,
      name: driverData.name,
      description: driverData.description,
      category: driverData.category,
      data_type: driverData.data_type,
      unit: driverData.unit,
      formula: driverData.formula,
      dependencies: driverData.dependencies,
      is_global: driverData.is_global ?? false,
      metadata: driverData.metadata,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating driver:', error);
    return createErrorResponse('Failed to create driver', 500);
  }

  return NextResponse.json(driver, { status: 201 });
});
