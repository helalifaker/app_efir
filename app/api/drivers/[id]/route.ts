import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabaseServer';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { UpdateDriverSchema } from '@/lib/schemas/planner';

/**
 * GET /api/drivers/[id]
 * Get a specific driver by ID
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    ctx?: { params?: Promise<Record<string, string>> }
  ) => {
    if (!ctx?.params) {
      return createErrorResponse('Missing route parameters', 400);
    }
    const params = await ctx.params;
    const driverId = params.id;

    const supabase = getServiceClient();

    const { data: driver, error } = await supabase
      .from('drivers')
      .select('*, driver_values(*)')
      .eq('id', driverId)
      .single();

    if (error) {
      console.error('Error fetching driver:', error);
      return createErrorResponse('Driver not found', 404);
    }

    return NextResponse.json(driver);
  }
);

/**
 * PATCH /api/drivers/[id]
 * Update a driver
 */
export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    ctx?: { params?: Promise<Record<string, string>> }
  ) => {
    if (!ctx?.params) {
      return createErrorResponse('Missing route parameters', 400);
    }
    const params = await ctx.params;
    const driverId = params.id;

    const body = await request.json();

    // Validate request body
    const validation = UpdateDriverSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        'Invalid driver data',
        400,
        validation.error.issues
      );
    }

    const updateData = validation.data;
    const supabase = getServiceClient();

    // Check if driver exists
    const { data: existing } = await supabase
      .from('drivers')
      .select('id, scenario_id')
      .eq('id', driverId)
      .single();

    if (!existing) {
      return createErrorResponse('Driver not found', 404);
    }

    // If name is being updated, check for duplicates
    if (updateData.name) {
      const { data: duplicate } = await supabase
        .from('drivers')
        .select('id')
        .eq('scenario_id', existing.scenario_id)
        .eq('name', updateData.name)
        .neq('id', driverId)
        .single();

      if (duplicate) {
        return createErrorResponse(
          'Driver with this name already exists in scenario',
          409
        );
      }
    }

    // Update driver
    const { data: driver, error } = await supabase
      .from('drivers')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', driverId)
      .select()
      .single();

    if (error) {
      console.error('Error updating driver:', error);
      return createErrorResponse('Failed to update driver', 500);
    }

    return NextResponse.json(driver);
  }
);

/**
 * DELETE /api/drivers/[id]
 * Delete a driver
 */
export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    ctx?: { params?: Promise<Record<string, string>> }
  ) => {
    if (!ctx?.params) {
      return createErrorResponse('Missing route parameters', 400);
    }
    const params = await ctx.params;
    const driverId = params.id;

    const supabase = getServiceClient();

    // Check if driver exists
    const { data: existing } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('id', driverId)
      .single();

    if (!existing) {
      return createErrorResponse('Driver not found', 404);
    }

    // Check if driver is referenced by other drivers (dependencies)
    const { data: dependentDrivers } = await supabase
      .from('drivers')
      .select('id, name, dependencies')
      .neq('id', driverId);

    const hasDependents = dependentDrivers?.some((driver: { dependencies?: string[] }) =>
      driver.dependencies?.includes(driverId)
    );

    if (hasDependents) {
      return createErrorResponse(
        'Cannot delete driver: it is referenced by other drivers',
        409
      );
    }

    // Delete driver (cascade will delete driver_values)
    const { error } = await supabase
      .from('drivers')
      .delete()
      .eq('id', driverId);

    if (error) {
      console.error('Error deleting driver:', error);
      return createErrorResponse('Failed to delete driver', 500);
    }

    return NextResponse.json({ message: 'Driver deleted successfully' });
  }
);
