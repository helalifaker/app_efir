/**
 * Opex Plan API
 * Manage operating expenses as % of revenue with optional sub-accounts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const opexPlanSchema = z.object({
  sub_account: z.string().nullable(),
  pct_of_revenue: z.number().min(0).max(100),
  amount: z.number().nonnegative()
})

const batchOpexSchema = z.array(opexPlanSchema)

// ============================================================================
// GET: Fetch opex plans for a version
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: versionId } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('opex_plan')
      .select('*')
      .eq('version_id', versionId)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Separate main opex from sub-accounts
    const mainOpex = data?.find(d => d.sub_account === null)
    const subAccounts = data?.filter(d => d.sub_account !== null) || []

    // Validate total percentage if sub-accounts exist
    let totalPct = 0
    if (subAccounts.length > 0) {
      totalPct = subAccounts.reduce((sum, acc) => sum + (acc.pct_of_revenue || 0), 0)
    } else if (mainOpex) {
      totalPct = mainOpex.pct_of_revenue || 0
    }

    return NextResponse.json({
      version_id: versionId,
      opex_structure: {
        type: subAccounts.length > 0 ? 'sub_accounts' : 'single',
        main: mainOpex || null,
        sub_accounts: subAccounts,
        total_pct: totalPct,
        valid: subAccounts.length > 0 ? Math.abs(totalPct - 100) < 0.01 : true
      }
    })
  } catch (error) {
    console.error('Error fetching opex plans:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST: Create or update opex plans
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: versionId } = await params
    const body = await request.json()

    const validated = batchOpexSchema.parse(body.opex_plans)

    const supabase = await createClient()

    // Check version exists and user has access
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

    if (version.status === 'Locked' || version.status === 'Archived') {
      return NextResponse.json(
        { error: 'Cannot edit locked or archived versions' },
        { status: 403 }
      )
    }

    // Validate percentages
    const subAccounts = validated.filter(p => p.sub_account !== null)
    if (subAccounts.length > 0) {
      const totalPct = subAccounts.reduce((sum, acc) => sum + acc.pct_of_revenue, 0)
      if (Math.abs(totalPct - 100) > 0.01) {
        return NextResponse.json(
          {
            error: `Sub-account percentages must sum to 100% (current: ${totalPct.toFixed(2)}%)`
          },
          { status: 400 }
        )
      }
    }

    // Delete existing opex plans for this version
    await supabase
      .from('opex_plan')
      .delete()
      .eq('version_id', versionId)

    // Insert new plans
    const opexData = validated.map(plan => ({
      version_id: versionId,
      ...plan
    }))

    const { data, error } = await supabase
      .from('opex_plan')
      .insert(opexData)
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

    console.error('Error creating opex plans:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// PUT: Update specific opex plan
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: versionId } = await params
    const body = await request.json()

    const validated = opexPlanSchema.parse(body)

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

    // Update opex plan
    const { data, error } = await supabase
      .from('opex_plan')
      .update({
        pct_of_revenue: validated.pct_of_revenue,
        amount: validated.amount,
        updated_at: new Date().toISOString()
      })
      .eq('version_id', versionId)
      .eq('sub_account', validated.sub_account)
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

    console.error('Error updating opex plan:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE: Remove opex plan
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: versionId } = await params
    const { searchParams } = new URL(request.url)

    const subAccount = searchParams.get('sub_account')

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

    // Delete opex plan
    let query = supabase
      .from('opex_plan')
      .delete()
      .eq('version_id', versionId)

    if (subAccount) {
      query = query.eq('sub_account', subAccount)
    } else {
      query = query.is('sub_account', null)
    }

    const { error } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Deleted opex plan${subAccount ? ` for sub-account: ${subAccount}` : ''}`
    })
  } catch (error) {
    console.error('Error deleting opex plan:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
