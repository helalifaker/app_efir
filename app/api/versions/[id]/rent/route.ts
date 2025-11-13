/**
 * Rent Plan API
 * CRUD operations for rent planning with three models:
 * - FixedEscalation, RevenueShare, PartnerModel
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  calculateRent,
  calculateRentProjection,
  RentModel,
  validateRentModel
} from '@/lib/engine/rentCalculator'

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const fixedEscalationConfigSchema = z.object({
  baseRent: z.number().positive(),
  escalationRate: z.number().nonnegative(),
  escalationFrequency: z.number().int().min(1).max(3)
})

const revenueShareConfigSchema = z.object({
  revenueSharePct: z.number().min(0).max(100),
  minimumRent: z.number().nonnegative().optional(),
  maximumRent: z.number().nonnegative().optional()
})

const partnerModelConfigSchema = z.object({
  landSize: z.number().positive(),
  landPricePerSqm: z.number().positive(),
  buaSize: z.number().positive(),
  buaPricePerSqm: z.number().positive(),
  yieldBase: z.number().positive(),
  yieldGrowthRate: z.number().nonnegative(),
  growthFrequency: z.number().int().min(1).max(3)
})

const rentPlanSchema = z.object({
  year: z.number().int().min(2023).max(2052),
  model_type: z.enum(['FixedEscalation', 'RevenueShare', 'PartnerModel']).nullable(),
  amount: z.number().nonnegative(),
  model_config: z.union([
    fixedEscalationConfigSchema,
    revenueShareConfigSchema,
    partnerModelConfigSchema,
    z.null()
  ])
})

const batchRentPlanSchema = z.array(rentPlanSchema)

// ============================================================================
// GET: Fetch rent plans for a version
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: versionId } = await params
    const supabase = await createClient()

    // Get rent plans
    const { data, error } = await supabase
      .from('rent_plan')
      .select('*')
      .eq('version_id', versionId)
      .order('year', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Categorize by period
    const historical = data?.filter(d => d.year >= 2023 && d.year <= 2024) || []
    const transition = data?.filter(d => d.year >= 2025 && d.year <= 2027) || []
    const relocation = data?.filter(d => d.year >= 2028) || []

    return NextResponse.json({
      version_id: versionId,
      rent_plans: data || [],
      by_period: {
        historical,
        transition,
        relocation
      },
      total_years: data?.length || 0
    })
  } catch (error) {
    console.error('Error fetching rent plans:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST: Create or update rent plans with calculation
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: versionId } = await params
    const body = await request.json()

    const supabase = await createClient()

    // Check if version exists and user has access
    const { data: version, error: versionError } = await supabase
      .from('model_versions')
      .select('id, status')
      .eq('id', versionId)
      .single()

    if (versionError || !version) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      )
    }

    // Can only edit Draft or Ready versions
    if (version.status === 'Locked' || version.status === 'Archived') {
      return NextResponse.json(
        { error: 'Cannot edit locked or archived versions' },
        { status: 403 }
      )
    }

    // Handle two modes: batch or single with projection
    if (body.mode === 'projection') {
      // Calculate projection for years based on model
      const { model_type, model_config, start_year, end_year, base_year } = body

      if (!model_type || !model_config || !start_year || !end_year || !base_year) {
        return NextResponse.json(
          { error: 'Missing required fields for projection mode' },
          { status: 400 }
        )
      }

      // Validate model
      const rentModel: RentModel = { type: model_type, config: model_config }
      const validationErrors = validateRentModel(rentModel)

      if (validationErrors.length > 0) {
        return NextResponse.json(
          { error: 'Invalid rent model', details: validationErrors },
          { status: 400 }
        )
      }

      // Calculate projection
      const projection = calculateRentProjection(
        rentModel,
        start_year,
        end_year,
        base_year
      )

      // Prepare data for upsert
      const rentData = projection.map(p => ({
        version_id: versionId,
        year: p.year,
        model_type: p.model,
        amount: p.rent,
        model_config: model_config
      }))

      const { data, error } = await supabase
        .from('rent_plan')
        .upsert(rentData, {
          onConflict: 'version_id,year'
        })
        .select()

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        mode: 'projection',
        data,
        projection,
        count: data?.length || 0
      })
    } else {
      // Batch mode: validate and upsert
      const validated = batchRentPlanSchema.parse(body.rent_plans)

      // Validate transition years (2025-2027) should not have model_type
      for (const plan of validated) {
        if (plan.year >= 2025 && plan.year <= 2027 && plan.model_type !== null) {
          return NextResponse.json(
            {
              error: `Transition year ${plan.year} should not have a rent model (clone from 2024A)`
            },
            { status: 400 }
          )
        }

        // Relocation years (2028+) must have model_type
        if (plan.year >= 2028 && plan.model_type === null) {
          return NextResponse.json(
            {
              error: `Relocation year ${plan.year} must have a rent model`
            },
            { status: 400 }
          )
        }
      }

      const rentData = validated.map(plan => ({
        version_id: versionId,
        ...plan
      }))

      const { data, error } = await supabase
        .from('rent_plan')
        .upsert(rentData, {
          onConflict: 'version_id,year'
        })
        .select()

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        mode: 'batch',
        data,
        count: data?.length || 0
      })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating rent plans:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// PUT: Update specific rent plan
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: versionId } = await params
    const body = await request.json()

    const validated = rentPlanSchema.parse(body)

    const supabase = await createClient()

    // Check version status
    const { data: version, error: versionError } = await supabase
      .from('model_versions')
      .select('status')
      .eq('id', versionId)
      .single()

    if (versionError || !version) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      )
    }

    if (version.status === 'Locked' || version.status === 'Archived') {
      return NextResponse.json(
        { error: 'Cannot edit locked or archived versions' },
        { status: 403 }
      )
    }

    // Update rent plan
    const { data, error } = await supabase
      .from('rent_plan')
      .update({
        model_type: validated.model_type,
        amount: validated.amount,
        model_config: validated.model_config,
        updated_at: new Date().toISOString()
      })
      .eq('version_id', versionId)
      .eq('year', validated.year)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating rent plan:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE: Remove rent plan for a year
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: versionId } = await params
    const { searchParams } = new URL(request.url)

    const year = searchParams.get('year')

    if (!year) {
      return NextResponse.json(
        { error: 'year query parameter required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check version status
    const { data: version, error: versionError } = await supabase
      .from('model_versions')
      .select('status')
      .eq('id', versionId)
      .single()

    if (versionError || !version) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      )
    }

    if (version.status === 'Locked' || version.status === 'Archived') {
      return NextResponse.json(
        { error: 'Cannot delete from locked or archived versions' },
        { status: 403 }
      )
    }

    // Delete rent plan
    const { error } = await supabase
      .from('rent_plan')
      .delete()
      .eq('version_id', versionId)
      .eq('year', parseInt(year))

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Deleted rent plan for year ${year}`
    })
  } catch (error) {
    console.error('Error deleting rent plan:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
