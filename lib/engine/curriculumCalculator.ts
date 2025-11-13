/**
 * Curriculum Calculator Engine
 * Handles dual-curriculum model (French & IB) with aggregation
 * Calculates revenue, staff costs, and aggregates across curricula
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type CurriculumType = 'FR' | 'IB'

export interface CurriculumData {
  curriculumType: CurriculumType
  year: number
  capacity: number
  students: number
  tuition: number // Base tuition (before CPI)
  teacherRatio: number // e.g., 0.15 = 1 teacher per 6.67 students
  nonTeacherRatio: number // e.g., 0.08
  cpiFrequency: number // 1, 2, or 3 years
  cpiBaseYear: number
}

export interface StaffCosts {
  teacherCosts: number
  nonTeacherCosts: number
  totalStaffCosts: number
}

export interface CurriculumFinancials {
  curriculum: CurriculumType
  year: number
  students: number
  capacity: number
  utilizationPct: number
  tuitionBase: number
  tuitionAdjusted: number // After CPI
  revenue: number
  staffCosts: StaffCosts
}

export interface AggregateFinancials {
  year: number
  totalRevenue: number
  totalStudents: number
  totalCapacity: number
  totalUtilizationPct: number
  totalStaffCosts: number
  revenueByClass: Record<CurriculumType, number>
  studentsByClass: Record<CurriculumType, number>
  staffCostsByClass: Record<CurriculumType, number>
  curricula: CurriculumFinancials[]
}

// ============================================================================
// TUITION CPI ADJUSTMENT
// ============================================================================

/**
 * Apply CPI adjustment to tuition based on frequency
 * CPI applied only when (year - baseYear) % frequency == 0
 *
 * Examples:
 * - frequency=1: CPI applied every year
 * - frequency=2: CPI applied every 2 years (2025, 2027, 2029...)
 * - frequency=3: CPI applied every 3 years (2026, 2029, 2032...)
 */
export function applyTuitionCPI(
  baseTuition: number,
  currentYear: number,
  baseYear: number,
  frequency: number,
  cpiRate: number
): number {
  const yearsSinceBase = currentYear - baseYear
  const numberOfApplications = Math.floor(yearsSinceBase / frequency)
  return baseTuition * Math.pow(1 + cpiRate, numberOfApplications)
}

// ============================================================================
// REVENUE CALCULATION
// ============================================================================

/**
 * Calculate revenue for a curriculum
 * Formula: Revenue = Students × Tuition (with CPI adjustment)
 */
export function calculateRevenue(
  curriculumData: CurriculumData,
  cpiRate: number
): number {
  const adjustedTuition = applyTuitionCPI(
    curriculumData.tuition,
    curriculumData.year,
    curriculumData.cpiBaseYear,
    curriculumData.cpiFrequency,
    cpiRate
  )

  return curriculumData.students * adjustedTuition
}

// ============================================================================
// STAFF COSTS CALCULATION
// ============================================================================

/**
 * Calculate salary with CPI adjustment
 * Salaries increase annually: salary(t) = baseSalary × (1 + CPI)^(t - baseYear)
 */
export function calculateSalaryWithCPI(
  baseSalary: number,
  currentYear: number,
  baseYear: number,
  cpiRate: number
): number {
  const yearsSinceBase = currentYear - baseYear
  return baseSalary * Math.pow(1 + cpiRate, yearsSinceBase)
}

/**
 * Calculate staff costs for a curriculum
 *
 * Staff Costs = Teacher Costs + Non-Teacher Costs
 * where:
 * - Teacher Costs = Students × Teacher Ratio × Teacher Salary (with CPI)
 * - Non-Teacher Costs = Students × Non-Teacher Ratio × Non-Teacher Salary (with CPI)
 */
export function calculateStaffCosts(
  curriculumData: CurriculumData,
  teacherSalaryBase: number,
  nonTeacherSalaryBase: number,
  cpiRate: number,
  salaryBaseYear: number
): StaffCosts {
  // Calculate salaries with CPI adjustment
  const teacherSalary = calculateSalaryWithCPI(
    teacherSalaryBase,
    curriculumData.year,
    salaryBaseYear,
    cpiRate
  )

  const nonTeacherSalary = calculateSalaryWithCPI(
    nonTeacherSalaryBase,
    curriculumData.year,
    salaryBaseYear,
    cpiRate
  )

  // Calculate costs
  const teacherCosts =
    curriculumData.students * curriculumData.teacherRatio * teacherSalary

  const nonTeacherCosts =
    curriculumData.students * curriculumData.nonTeacherRatio * nonTeacherSalary

  return {
    teacherCosts,
    nonTeacherCosts,
    totalStaffCosts: teacherCosts + nonTeacherCosts
  }
}

// ============================================================================
// CURRICULUM FINANCIALS
// ============================================================================

export interface CurriculumCalculationParams {
  curriculumData: CurriculumData
  teacherSalaryBase: number
  nonTeacherSalaryBase: number
  cpiRate: number
  salaryBaseYear: number
}

/**
 * Calculate complete financials for a single curriculum
 */
export function calculateCurriculumFinancials(
  params: CurriculumCalculationParams
): CurriculumFinancials {
  const { curriculumData, teacherSalaryBase, nonTeacherSalaryBase, cpiRate, salaryBaseYear } = params

  // Calculate tuition with CPI
  const tuitionAdjusted = applyTuitionCPI(
    curriculumData.tuition,
    curriculumData.year,
    curriculumData.cpiBaseYear,
    curriculumData.cpiFrequency,
    cpiRate
  )

  // Calculate revenue
  const revenue = curriculumData.students * tuitionAdjusted

  // Calculate staff costs
  const staffCosts = calculateStaffCosts(
    curriculumData,
    teacherSalaryBase,
    nonTeacherSalaryBase,
    cpiRate,
    salaryBaseYear
  )

  // Calculate utilization
  const utilizationPct = curriculumData.capacity > 0
    ? (curriculumData.students / curriculumData.capacity) * 100
    : 0

  return {
    curriculum: curriculumData.curriculumType,
    year: curriculumData.year,
    students: curriculumData.students,
    capacity: curriculumData.capacity,
    utilizationPct,
    tuitionBase: curriculumData.tuition,
    tuitionAdjusted,
    revenue,
    staffCosts
  }
}

// ============================================================================
// DUAL-CURRICULUM AGGREGATION
// ============================================================================

export interface AggregationParams {
  frData: CurriculumData
  ibData: CurriculumData
  teacherSalaryFR: number
  teacherSalaryIB: number
  nonTeacherSalaryFR: number
  nonTeacherSalaryIB: number
  cpiRate: number
  salaryBaseYear: number
}

/**
 * Aggregate financials across French and IB curricula
 *
 * Aggregation Logic:
 * - Total Revenue = Revenue(FR) + Revenue(IB)
 * - Total Students = Students(FR) + Students(IB)
 * - Total Capacity = Capacity(FR) + Capacity(IB)
 * - Total Staff Costs = Staff Costs(FR) + Staff Costs(IB)
 */
export function aggregateCurricula(
  params: AggregationParams
): AggregateFinancials {
  const {
    frData,
    ibData,
    teacherSalaryFR,
    teacherSalaryIB,
    nonTeacherSalaryFR,
    nonTeacherSalaryIB,
    cpiRate,
    salaryBaseYear
  } = params

  // Validate both curricula have same year
  if (frData.year !== ibData.year) {
    throw new Error(
      `Year mismatch: FR=${frData.year}, IB=${ibData.year}`
    )
  }

  // Calculate French financials
  const frFinancials = calculateCurriculumFinancials({
    curriculumData: frData,
    teacherSalaryBase: teacherSalaryFR,
    nonTeacherSalaryBase: nonTeacherSalaryFR,
    cpiRate,
    salaryBaseYear
  })

  // Calculate IB financials
  const ibFinancials = calculateCurriculumFinancials({
    curriculumData: ibData,
    teacherSalaryBase: teacherSalaryIB,
    nonTeacherSalaryBase: nonTeacherSalaryIB,
    cpiRate,
    salaryBaseYear
  })

  // Aggregate totals
  const totalRevenue = frFinancials.revenue + ibFinancials.revenue
  const totalStudents = frFinancials.students + ibFinancials.students
  const totalCapacity = frFinancials.capacity + ibFinancials.capacity
  const totalStaffCosts =
    frFinancials.staffCosts.totalStaffCosts +
    ibFinancials.staffCosts.totalStaffCosts

  const totalUtilizationPct = totalCapacity > 0
    ? (totalStudents / totalCapacity) * 100
    : 0

  return {
    year: frData.year,
    totalRevenue,
    totalStudents,
    totalCapacity,
    totalUtilizationPct,
    totalStaffCosts,
    revenueByClass: {
      FR: frFinancials.revenue,
      IB: ibFinancials.revenue
    },
    studentsByClass: {
      FR: frFinancials.students,
      IB: ibFinancials.students
    },
    staffCostsByClass: {
      FR: frFinancials.staffCosts.totalStaffCosts,
      IB: ibFinancials.staffCosts.totalStaffCosts
    },
    curricula: [frFinancials, ibFinancials]
  }
}

// ============================================================================
// MULTI-YEAR AGGREGATION
// ============================================================================

/**
 * Aggregate curricula for multiple years
 */
export function aggregateCurriculaMultiYear(
  frDataByYear: Map<number, CurriculumData>,
  ibDataByYear: Map<number, CurriculumData>,
  teacherSalaryFR: number,
  teacherSalaryIB: number,
  nonTeacherSalaryFR: number,
  nonTeacherSalaryIB: number,
  cpiRateByYear: Map<number, number>,
  salaryBaseYear: number
): AggregateFinancials[] {
  const results: AggregateFinancials[] = []

  // Get all years (intersection of FR and IB years)
  const frYears = Array.from(frDataByYear.keys())
  const ibYears = Array.from(ibDataByYear.keys())
  const commonYears = frYears.filter(year => ibYears.includes(year))

  // Aggregate for each year
  for (const year of commonYears.sort()) {
    const frData = frDataByYear.get(year)!
    const ibData = ibDataByYear.get(year)!
    const cpiRate = cpiRateByYear.get(year) || 0

    const aggregated = aggregateCurricula({
      frData,
      ibData,
      teacherSalaryFR,
      teacherSalaryIB,
      nonTeacherSalaryFR,
      nonTeacherSalaryIB,
      cpiRate,
      salaryBaseYear
    })

    results.push(aggregated)
  }

  return results
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate curriculum data
 */
export function validateCurriculumData(data: CurriculumData): string[] {
  const errors: string[] = []

  if (data.capacity <= 0) {
    errors.push('Capacity must be greater than 0')
  }

  if (data.students < 0) {
    errors.push('Students cannot be negative')
  }

  if (data.students > data.capacity) {
    errors.push('Students cannot exceed capacity')
  }

  if (data.tuition <= 0) {
    errors.push('Tuition must be greater than 0')
  }

  if (data.teacherRatio <= 0 || data.teacherRatio >= 1) {
    errors.push('Teacher ratio must be between 0 and 1')
  }

  if (data.nonTeacherRatio <= 0 || data.nonTeacherRatio >= 1) {
    errors.push('Non-teacher ratio must be between 0 and 1')
  }

  if (![1, 2, 3].includes(data.cpiFrequency)) {
    errors.push('CPI frequency must be 1, 2, or 3 years')
  }

  if (data.year < 2023 || data.year > 2052) {
    errors.push('Year must be between 2023 and 2052')
  }

  return errors
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate average tuition across curricula
 */
export function calculateAverageTuition(
  frRevenue: number,
  frStudents: number,
  ibRevenue: number,
  ibStudents: number
): number {
  const totalRevenue = frRevenue + ibRevenue
  const totalStudents = frStudents + ibStudents

  if (totalStudents === 0) return 0
  return totalRevenue / totalStudents
}

/**
 * Calculate staff cost per student
 */
export function calculateStaffCostPerStudent(
  totalStaffCosts: number,
  totalStudents: number
): number {
  if (totalStudents === 0) return 0
  return totalStaffCosts / totalStudents
}

/**
 * Calculate revenue per square meter (if BUA provided)
 */
export function calculateRevenuePerSqm(
  totalRevenue: number,
  buaSize: number
): number {
  if (buaSize === 0) return 0
  return totalRevenue / buaSize
}
