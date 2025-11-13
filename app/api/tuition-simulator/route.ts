/**
 * Tuition Simulator API
 * Rent-driven simulation to maintain target EBITDA
 * Calculates required tuition adjustments per curriculum
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  calculateRent,
  RentModel,
  calculateRentLoadPercent
} from '@/lib/engine/rentCalculator'
import {
  aggregateCurricula,
  CurriculumData
} from '@/lib/engine/curriculumCalculator'
import {
  calculateCOGS,
  calculateEBITDA
} from '@/lib/engine/financialStatements'

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const simulationRequestSchema = z.object({
  version_id: z.string().uuid(),
  rent_model: z.object({
    type: z.enum(['FixedEscalation', 'RevenueShare', 'PartnerModel']),
    config: z.any() // Will be validated by rent calculator
  }),
  tuition_adjustment: z.object({
    fr: z.number().min(-20).max(50), // -20% to +50%
    ib: z.number().min(-20).max(50)
  }),
  target_ebitda: z.union([
    z.object({
      type: z.literal('margin'),
      value: z.number().min(0).max(100) // %
    }),
    z.object({
      type: z.literal('absolute'),
      value: z.number() // absolute amount
    })
  ]).optional(),
  years: z.object({
    start: z.number().int().min(2023).max(2052),
    end: z.number().int().min(2023).max(2052)
  })
})

// ============================================================================
// POST: Run Tuition Simulation
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = simulationRequestSchema.parse(body)

    const supabase = await createClient()

    // Fetch version data
    const { data: version, error: versionError } = await supabase
      .from('model_versions')
      .select('id, name, status')
      .eq('id', validated.version_id)
      .single()

    if (versionError || !version) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      )
    }

    // Fetch curriculum data
    const { data: curriculumData, error: curriculumError } = await supabase
      .from('curriculum_plan')
      .select('*')
      .eq('version_id', validated.version_id)
      .gte('year', validated.years.start)
      .lte('year', validated.years.end)
      .order('year')

    if (curriculumError) {
      return NextResponse.json(
        { error: curriculumError.message },
        { status: 500 }
      )
    }

    if (!curriculumData || curriculumData.length === 0) {
      return NextResponse.json(
        { error: 'No curriculum data found for this version' },
        { status: 404 }
      )
    }

    // Fetch opex data
    const { data: opexData, error: opexError } = await supabase
      .from('opex_plan')
      .select('*')
      .eq('version_id', validated.version_id)

    if (opexError) {
      return NextResponse.json(
        { error: opexError.message },
        { status: 500 }
      )
    }

    // Get admin config for salaries and CPI
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('*')
      .in('key', ['teacher_salary', 'non_teacher_salary', 'cpi'])

    if (settingsError) {
      return NextResponse.json(
        { error: settingsError.message },
        { status: 500 }
      )
    }

    // Parse settings
    const teacherSalary = settings?.find(s => s.key === 'teacher_salary')?.value
    const nonTeacherSalary = settings?.find(s => s.key === 'non_teacher_salary')?.value
    const cpiSettings = settings?.find(s => s.key === 'cpi')?.value

    if (!teacherSalary || !nonTeacherSalary || !cpiSettings) {
      return NextResponse.json(
        { error: 'Missing salary or CPI configuration in admin settings' },
        { status: 500 }
      )
    }

    // Run simulation year by year
    const results = []
    const years = []
    for (let year = validated.years.start; year <= validated.years.end; year++) {
      years.push(year)

      // Get curriculum data for this year
      const frData = curriculumData.find(
        d => d.year === year && d.curriculum_type === 'FR'
      )
      const ibData = curriculumData.find(
        d => d.year === year && d.curriculum_type === 'IB'
      )

      if (!frData || !ibData) {
        continue // Skip years without complete data
      }

      // Apply tuition adjustments
      const adjustedFRTuition = frData.tuition * (1 + validated.tuition_adjustment.fr / 100)
      const adjustedIBTuition = ibData.tuition * (1 + validated.tuition_adjustment.ib / 100)

      // Calculate aggregated financials
      const cpiRate = cpiSettings.rates?.[year] || 0.03 // Default 3%

      const aggregated = aggregateCurricula({
        frData: {
          ...frData,
          tuition: adjustedFRTuition
        } as CurriculumData,
        ibData: {
          ...ibData,
          tuition: adjustedIBTuition
        } as CurriculumData,
        teacherSalaryFR: teacherSalary.fr_base,
        teacherSalaryIB: teacherSalary.ib_base,
        nonTeacherSalaryFR: nonTeacherSalary.fr_base,
        nonTeacherSalaryIB: nonTeacherSalary.ib_base,
        cpiRate,
        salaryBaseYear: cpiSettings.baseYear || 2023
      })

      // Calculate rent
      const rentModel: RentModel = validated.rent_model as RentModel
      const rent = calculateRent({
        model: rentModel,
        year,
        baseYear: validated.years.start,
        revenue: aggregated.totalRevenue
      })

      // Calculate opex
      const opexPct = opexData?.find(o => o.sub_account === null)?.pct_of_revenue || 25
      const opex = aggregated.totalRevenue * (opexPct / 100)

      // Calculate COGS and EBITDA
      const cogs = calculateCOGS(aggregated.totalStaffCosts, rent, opex)
      const ebitda = calculateEBITDA(aggregated.totalRevenue, cogs.totalCOGS, 0)

      // Calculate metrics
      const ebitdaMargin = (ebitda / aggregated.totalRevenue) * 100
      const rentLoadPct = calculateRentLoadPercent(rent, aggregated.totalRevenue)

      results.push({
        year,
        revenue: aggregated.totalRevenue,
        staffCosts: aggregated.totalStaffCosts,
        rent,
        opex,
        cogs: cogs.totalCOGS,
        ebitda,
        ebitdaMargin,
        rentLoadPct,
        tuition: {
          fr: adjustedFRTuition,
          ib: adjustedIBTuition
        },
        students: {
          fr: frData.students,
          ib: ibData.students,
          total: aggregated.totalStudents
        }
      })
    }

    // Calculate summary metrics
    const avgEBITDAMargin = results.reduce((sum, r) => sum + r.ebitdaMargin, 0) / results.length
    const avgRentLoad = results.reduce((sum, r) => sum + r.rentLoadPct, 0) / results.length
    const totalRevenue = results.reduce((sum, r) => sum + r.revenue, 0)
    const totalEBITDA = results.reduce((sum, r) => sum + r.ebitda, 0)

    // Check if target EBITDA met
    let targetMet = true
    let targetDetails = null

    if (validated.target_ebitda) {
      if (validated.target_ebitda.type === 'margin') {
        targetMet = avgEBITDAMargin >= validated.target_ebitda.value
        targetDetails = {
          type: 'margin',
          target: validated.target_ebitda.value,
          actual: avgEBITDAMargin,
          met: targetMet
        }
      } else {
        const avgEBITDA = totalEBITDA / results.length
        targetMet = avgEBITDA >= validated.target_ebitda.value
        targetDetails = {
          type: 'absolute',
          target: validated.target_ebitda.value,
          actual: avgEBITDA,
          met: targetMet
        }
      }
    }

    // Save simulation (optional - for history)
    const simulationRecord = {
      version_id: validated.version_id,
      rent_model_type: validated.rent_model.type,
      adjustment_factor_fr: validated.tuition_adjustment.fr,
      adjustment_factor_ib: validated.tuition_adjustment.ib,
      target_margin: validated.target_ebitda?.type === 'margin' ? validated.target_ebitda.value : null,
      target_ebitda: validated.target_ebitda?.type === 'absolute' ? validated.target_ebitda.value : null,
      results: {
        years: results,
        summary: {
          avgEBITDAMargin,
          avgRentLoad,
          totalRevenue,
          totalEBITDA
        },
        target: targetDetails
      }
    }

    const { data: savedSimulation, error: saveError } = await supabase
      .from('tuition_simulation')
      .insert(simulationRecord)
      .select()
      .single()

    if (saveError) {
      console.warn('Could not save simulation:', saveError.message)
    }

    return NextResponse.json({
      success: true,
      simulation_id: savedSimulation?.id,
      version: {
        id: version.id,
        name: version.name
      },
      rent_model: validated.rent_model.type,
      tuition_adjustment: validated.tuition_adjustment,
      results: results,
      summary: {
        avgEBITDAMargin,
        avgRentLoad,
        totalRevenue,
        totalEBITDA,
        years: years.length
      },
      target: targetDetails
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error running tuition simulation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET: Fetch simulation history for a version
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const versionId = searchParams.get('version_id')

    if (!versionId) {
      return NextResponse.json(
        { error: 'version_id query parameter required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('tuition_simulation')
      .select('*')
      .eq('version_id', versionId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      version_id: versionId,
      simulations: data || [],
      count: data?.length || 0
    })
  } catch (error) {
    console.error('Error fetching simulations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
