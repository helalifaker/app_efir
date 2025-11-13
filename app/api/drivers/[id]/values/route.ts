import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabaseServer';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { CreateDriverValueSchema, BulkDriverValuesSchema } from '@/lib/schemas/planner';

/**
 * GET /api/drivers/[id]/values
 * Get driver values for a specific driver
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

    const { searchParams } = new URL(request.url);
    const startYear = searchParams.get('start_year');
    const endYear = searchParams.get('end_year');
    const scenarioId = searchParams.get('scenario_id');

    const supabase = getServiceClient();

    // Build query
    let query = supabase
      .from('driver_values')
      .select('*')
      .eq('driver_id', driverId)
      .order('year', { ascending: true });

    if (scenarioId) {
      query = query.eq('scenario_id', scenarioId);
    }

    if (startYear) {
      query = query.gte('year', parseInt(startYear));
    }

    if (endYear) {
      query = query.lte('year', parseInt(endYear));
    }

    const { data: values, error } = await query;

    if (error) {
      console.error('Error fetching driver values:', error);
      return createErrorResponse('Failed to fetch driver values', 500);
    }

    return NextResponse.json(values);
  }
);

/**
 * POST /api/drivers/[id]/values
 * Create or update driver values (supports bulk operations)
 */
export const POST = withErrorHandler(
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

    // Check if bulk or single value
    const isBulk = Array.isArray(body.values);
    const validation = isBulk
      ? BulkDriverValuesSchema.safeParse(body)
      : CreateDriverValueSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse(
        'Invalid driver value data',
        400,
        validation.error.issues
      );
    }

    const supabase = getServiceClient();

    // Verify driver exists
    const { data: driver } = await supabase
      .from('drivers')
      .select('id, scenario_id')
      .eq('id', driverId)
      .single();

    if (!driver) {
      return createErrorResponse('Driver not found', 404);
    }

    if (isBulk) {
      const bulkData = validation.data as { scenario_id: string; values: Array<{ year: number; value: number; source?: string; notes?: string }> };

      // Prepare bulk insert data
      const valuesToInsert = bulkData.values.map((v) => ({
        driver_id: driverId,
        scenario_id: bulkData.scenario_id,
        year: v.year,
        value: v.value,
        source: v.source,
        notes: v.notes,
      }));

      // Use upsert to handle duplicates
      const { data: insertedValues, error } = await supabase
        .from('driver_values')
        .upsert(valuesToInsert, {
          onConflict: 'driver_id,scenario_id,year',
          ignoreDuplicates: false,
        })
        .select();

      if (error) {
        console.error('Error creating driver values:', error);
        return createErrorResponse('Failed to create driver values', 500);
      }

      return NextResponse.json(
        {
          message: `${insertedValues?.length || 0} driver values saved successfully`,
          values: insertedValues,
        },
        { status: 201 }
      );
    } else {
      const singleData = validation.data as { scenario_id: string; year: number; value: number; source?: string; notes?: string };

      // Single value insert/update
      const { data: value, error } = await supabase
        .from('driver_values')
        .upsert(
          {
            driver_id: driverId,
            scenario_id: singleData.scenario_id,
            year: singleData.year,
            value: singleData.value,
            source: singleData.source,
            notes: singleData.notes,
          },
          {
            onConflict: 'driver_id,scenario_id,year',
            ignoreDuplicates: false,
          }
        )
        .select()
        .single();

      if (error) {
        console.error('Error creating driver value:', error);
        return createErrorResponse('Failed to create driver value', 500);
      }

      return NextResponse.json(value, { status: 201 });
    }
  }
);
