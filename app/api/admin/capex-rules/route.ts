/**
 * Capex Rule API (Admin)
 * Manage capex auto-reinvestment rules by asset class
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const capexRuleSchema = z.object({
  class: z.enum(['Building', 'FF&E', 'IT', 'Other']),
  cycle_years: z.number().int().positive(),
  inflation_index: z.string().min(1),
  base_cost: z.number().positive(),
  trigger_type: z.enum(['cycle', 'utilization', 'both']).default('cycle'),
  utilization_threshold: z.number().min(0).max(100).optional()
})

// ============================================================================
// GET: Fetch all capex rules
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('capex_rule')
      .select('*')
      .order('class', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Group by class for easy lookup
    const byClass = {
      Building: data?.filter(r => r.class === 'Building'),
      'FF&E': data?.filter(r => r.class === 'FF&E'),
      IT: data?.filter(r => r.class === 'IT'),
      Other: data?.filter(r => r.class === 'Other')
    }

    return NextResponse.json({
      rules: data || [],
      by_class: byClass,
      total: data?.length || 0
    })
  } catch (error) {
    console.error('Error fetching capex rules:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST: Create new capex rule
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = capexRuleSchema.parse(body)

    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate trigger type and utilization threshold
    if (
      (validated.trigger_type === 'utilization' || validated.trigger_type === 'both') &&
      !validated.utilization_threshold
    ) {
      return NextResponse.json(
        { error: 'utilization_threshold required when trigger_type is utilization or both' },
        { status: 400 }
      )
    }

    // Insert capex rule
    const { data, error } = await supabase
      .from('capex_rule')
      .insert({
        ...validated,
        created_by: user.id
      })
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
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating capex rule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// PUT: Update capex rule
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Rule ID required' },
        { status: 400 }
      )
    }

    const validated = capexRuleSchema.partial().parse(updates)

    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if rule exists and user owns it
    const { data: existing, error: fetchError } = await supabase
      .from('capex_rule')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Capex rule not found' },
        { status: 404 }
      )
    }

    // Update capex rule
    const { data, error } = await supabase
      .from('capex_rule')
      .update({
        ...validated,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
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

    console.error('Error updating capex rule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE: Remove capex rule
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Rule ID required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if rule exists
    const { data: existing, error: fetchError } = await supabase
      .from('capex_rule')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Capex rule not found' },
        { status: 404 }
      )
    }

    // Delete capex rule
    const { error } = await supabase
      .from('capex_rule')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Deleted capex rule for class: ${existing.class}`
    })
  } catch (error) {
    console.error('Error deleting capex rule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
