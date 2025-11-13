/**
 * Curriculum Plan API
 * CRUD operations for dual-curriculum planning data
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const curriculumPlanSchema = z.object({
  curriculum_type: z.enum(['FR', 'IB']),
  year: z.number().int().min(2023).max(2052),
  capacity: z.number().int().positive(),
  students: z.number().int().nonnegative(),
  tuition: z.number().positive(),
  teacher_ratio: z.number().positive().max(1),
  non_teacher_ratio: z.number().positive().max(1),
  cpi_frequency: z.enum([1, 2, 3]),
  cpi_base_year: z.number().int().min(2023)
})

const batchCurriculumSchema = z.array(curriculumPlanSchema)

// ============================================================================
// GET: Fetch curriculum plans for a version
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: versionId } = await params
    const supabase = await createClient()

    // Get curriculum plans
    const { data, error } = await supabase
      .from('curriculum_plan')
      .select('*')
      .eq('version_id', versionId)
      .order('year', { ascending: true })
      .order('curriculum_type', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Group by curriculum type
    const frData = data?.filter(d => d.curriculum_type === 'FR') || []
    const ibData = data?.filter(d => d.curriculum_type === 'IB') || []

    return NextResponse.json({
      version_id: versionId,
      curricula: {
        FR: frData,
        IB: ibData
      },
      total_years: {
        FR: frData.length,
        IB: ibData.length
      }
    })
  } catch (error) {
    console.error('Error fetching curriculum plans:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST: Create or update curriculum plans (batch)
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: versionId } = await params
    const body = await request.json()

    // Validate input
    const validated = batchCurriculumSchema.parse(body.curricula)

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

    // Validate students <= capacity
    for (const plan of validated) {
      if (plan.students > plan.capacity) {
        return NextResponse.json(
          {
            error: `Students (${plan.students}) cannot exceed capacity (${plan.capacity}) for ${plan.curriculum_type} in year ${plan.year}`
          },
          { status: 400 }
        )
      }
    }

    // Upsert curriculum plans
    const curriculumData = validated.map(plan => ({
      version_id: versionId,
      ...plan
    }))

    const { data, error } = await supabase
      .from('curriculum_plan')
      .upsert(curriculumData, {
        onConflict: 'version_id,curriculum_type,year'
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
      data,
      count: data?.length || 0
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating curriculum plans:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// PUT: Update specific curriculum plan
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: versionId } = await params
    const body = await request.json()

    // Validate single curriculum plan
    const validated = curriculumPlanSchema.parse(body)

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

    // Validate students <= capacity
    if (validated.students > validated.capacity) {
      return NextResponse.json(
        { error: 'Students cannot exceed capacity' },
        { status: 400 }
      )
    }

    // Update curriculum plan
    const { data, error } = await supabase
      .from('curriculum_plan')
      .update({
        capacity: validated.capacity,
        students: validated.students,
        tuition: validated.tuition,
        teacher_ratio: validated.teacher_ratio,
        non_teacher_ratio: validated.non_teacher_ratio,
        cpi_frequency: validated.cpi_frequency,
        cpi_base_year: validated.cpi_base_year,
        updated_at: new Date().toISOString()
      })
      .eq('version_id', versionId)
      .eq('curriculum_type', validated.curriculum_type)
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

    console.error('Error updating curriculum plan:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE: Remove curriculum plans for a year/curriculum
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: versionId } = await params
    const { searchParams } = new URL(request.url)

    const year = searchParams.get('year')
    const curriculumType = searchParams.get('curriculum_type')

    if (!year || !curriculumType) {
      return NextResponse.json(
        { error: 'year and curriculum_type query parameters required' },
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

    // Delete curriculum plan
    const { error } = await supabase
      .from('curriculum_plan')
      .delete()
      .eq('version_id', versionId)
      .eq('curriculum_type', curriculumType)
      .eq('year', parseInt(year))

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${curriculumType} curriculum plan for year ${year}`
    })
  } catch (error) {
    console.error('Error deleting curriculum plan:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
