/**
 * Rent Calculator Engine
 * Implements three rent models for School Relocation Planner
 * - FixedEscalation: Base rent with periodic escalation
 * - RevenueShare: Percentage of revenue with optional min/max
 * - PartnerModel: Land/BUA-based with yield growth
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type RentModelType = 'FixedEscalation' | 'RevenueShare' | 'PartnerModel'

export interface RentModel {
  type: RentModelType
  config: RentModelConfig
}

export type RentModelConfig =
  | FixedEscalationConfig
  | RevenueShareConfig
  | PartnerModelConfig

// ============================================================================
// FIXED ESCALATION MODEL
// ============================================================================

export interface FixedEscalationConfig {
  baseRent: number
  escalationRate: number // e.g., 0.03 for 3%
  escalationFrequency: number // 1, 2, or 3 years
}

/**
 * Calculate rent using Fixed Escalation model
 * Formula: rent(t) = baseRent × (1 + rate)^(escalations)
 * where escalations = floor((year - baseYear) / frequency)
 */
export function calculateFixedEscalation(
  config: FixedEscalationConfig,
  year: number,
  baseYear: number
): number {
  const yearsSinceBase = year - baseYear
  const numberOfEscalations = Math.floor(yearsSinceBase / config.escalationFrequency)
  return config.baseRent * Math.pow(1 + config.escalationRate, numberOfEscalations)
}

// ============================================================================
// REVENUE SHARE MODEL
// ============================================================================

export interface RevenueShareConfig {
  revenueSharePct: number // e.g., 15 for 15%
  minimumRent?: number // optional floor
  maximumRent?: number // optional cap
}

/**
 * Calculate rent using Revenue Share model
 * Formula: rent = revenue × (pct / 100)
 * Apply min/max constraints if configured
 */
export function calculateRevenueShare(
  config: RevenueShareConfig,
  revenue: number
): number {
  let rent = revenue * (config.revenueSharePct / 100)

  // Apply minimum floor
  if (config.minimumRent !== undefined) {
    rent = Math.max(rent, config.minimumRent)
  }

  // Apply maximum cap
  if (config.maximumRent !== undefined) {
    rent = Math.min(rent, config.maximumRent)
  }

  return rent
}

// ============================================================================
// PARTNER MODEL
// ============================================================================

export interface PartnerModelConfig {
  landSize: number // square meters
  landPricePerSqm: number
  buaSize: number // Built-Up Area in square meters
  buaPricePerSqm: number
  yieldBase: number // e.g., 8 for 8%
  yieldGrowthRate: number // e.g., 0.005 for 0.5%
  growthFrequency: number // 1, 2, or 3 years
}

/**
 * Calculate rent using Partner Model
 * Step 1: Calculate capex base = (land × price) + (BUA × price)
 * Step 2: Calculate yield = yieldBase × (1 + growthRate)^(growths)
 * Step 3: rent = capex base × (yield / 100)
 */
export function calculatePartnerModel(
  config: PartnerModelConfig,
  year: number,
  baseYear: number
): number {
  // Calculate capex base (land + BUA investment)
  const capexBase =
    (config.landSize * config.landPricePerSqm) +
    (config.buaSize * config.buaPricePerSqm)

  // Calculate yield growth based on frequency
  const yearsSinceBase = year - baseYear
  const numberOfGrowths = Math.floor(yearsSinceBase / config.growthFrequency)
  const currentYield = config.yieldBase * Math.pow(1 + config.yieldGrowthRate, numberOfGrowths)

  // Calculate rent as capex × yield
  return capexBase * (currentYield / 100)
}

// ============================================================================
// UNIFIED RENT CALCULATION
// ============================================================================

export interface RentCalculationParams {
  model: RentModel
  year: number
  baseYear: number
  revenue?: number // Required for RevenueShare model
}

/**
 * Calculate rent for any model type
 * Dispatches to appropriate calculation function based on model type
 */
export function calculateRent(params: RentCalculationParams): number {
  const { model, year, baseYear, revenue } = params

  switch (model.type) {
    case 'FixedEscalation':
      return calculateFixedEscalation(
        model.config as FixedEscalationConfig,
        year,
        baseYear
      )

    case 'RevenueShare':
      if (revenue === undefined) {
        throw new Error('Revenue is required for RevenueShare model')
      }
      return calculateRevenueShare(
        model.config as RevenueShareConfig,
        revenue
      )

    case 'PartnerModel':
      return calculatePartnerModel(
        model.config as PartnerModelConfig,
        year,
        baseYear
      )

    default:
      throw new Error(`Unknown rent model type: ${(model as RentModel).type}`)
  }
}

// ============================================================================
// RENT PROJECTION (Multi-Year)
// ============================================================================

export interface RentProjection {
  year: number
  rent: number
  model: RentModelType
}

/**
 * Calculate rent projection for multiple years
 * Useful for displaying year-by-year rent in UI
 */
export function calculateRentProjection(
  model: RentModel,
  startYear: number,
  endYear: number,
  baseYear: number,
  revenueByYear?: Record<number, number> // For RevenueShare model
): RentProjection[] {
  const projections: RentProjection[] = []

  for (let year = startYear; year <= endYear; year++) {
    const revenue = revenueByYear?.[year]

    const rent = calculateRent({
      model,
      year,
      baseYear,
      revenue
    })

    projections.push({
      year,
      rent,
      model: model.type
    })
  }

  return projections
}

// ============================================================================
// NPV CALCULATION
// ============================================================================

/**
 * Calculate Net Present Value of rent cash flows
 * Formula: NPV = Σ(cashFlow / (1 + discountRate)^year)
 */
export function calculateNPV(
  cashFlows: number[],
  discountRate: number,
  startYear: number = 0
): number {
  return cashFlows.reduce((npv, cashFlow, index) => {
    const year = startYear + index
    return npv + cashFlow / Math.pow(1 + discountRate, year)
  }, 0)
}

/**
 * Calculate NPV specifically for rent projections
 */
export function calculateRentNPV(
  projections: RentProjection[],
  discountRate: number
): number {
  const cashFlows = projections.map(p => p.rent)
  return calculateNPV(cashFlows, discountRate)
}

// ============================================================================
// RENT LOAD PERCENTAGE
// ============================================================================

/**
 * Calculate Rent Load % = (Rent / Revenue) × 100
 * Key metric for School Relocation Planner
 */
export function calculateRentLoadPercent(
  rent: number,
  revenue: number
): number {
  if (revenue === 0) return 0
  return (rent / revenue) * 100
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate FixedEscalation config
 */
export function validateFixedEscalation(
  config: FixedEscalationConfig
): string[] {
  const errors: string[] = []

  if (config.baseRent <= 0) {
    errors.push('Base rent must be greater than 0')
  }

  if (config.escalationRate < 0) {
    errors.push('Escalation rate cannot be negative')
  }

  if (![1, 2, 3].includes(config.escalationFrequency)) {
    errors.push('Escalation frequency must be 1, 2, or 3 years')
  }

  return errors
}

/**
 * Validate RevenueShare config
 */
export function validateRevenueShare(
  config: RevenueShareConfig
): string[] {
  const errors: string[] = []

  if (config.revenueSharePct < 0 || config.revenueSharePct > 100) {
    errors.push('Revenue share percentage must be between 0 and 100')
  }

  if (config.minimumRent !== undefined && config.minimumRent < 0) {
    errors.push('Minimum rent cannot be negative')
  }

  if (config.maximumRent !== undefined && config.maximumRent < 0) {
    errors.push('Maximum rent cannot be negative')
  }

  if (
    config.minimumRent !== undefined &&
    config.maximumRent !== undefined &&
    config.minimumRent > config.maximumRent
  ) {
    errors.push('Minimum rent cannot exceed maximum rent')
  }

  return errors
}

/**
 * Validate PartnerModel config
 */
export function validatePartnerModel(
  config: PartnerModelConfig
): string[] {
  const errors: string[] = []

  if (config.landSize <= 0) {
    errors.push('Land size must be greater than 0')
  }

  if (config.landPricePerSqm <= 0) {
    errors.push('Land price per sqm must be greater than 0')
  }

  if (config.buaSize <= 0) {
    errors.push('BUA size must be greater than 0')
  }

  if (config.buaPricePerSqm <= 0) {
    errors.push('BUA price per sqm must be greater than 0')
  }

  if (config.yieldBase <= 0) {
    errors.push('Yield base must be greater than 0')
  }

  if (config.yieldGrowthRate < 0) {
    errors.push('Yield growth rate cannot be negative')
  }

  if (![1, 2, 3].includes(config.growthFrequency)) {
    errors.push('Growth frequency must be 1, 2, or 3 years')
  }

  return errors
}

/**
 * Validate any rent model configuration
 */
export function validateRentModel(model: RentModel): string[] {
  switch (model.type) {
    case 'FixedEscalation':
      return validateFixedEscalation(model.config as FixedEscalationConfig)
    case 'RevenueShare':
      return validateRevenueShare(model.config as RevenueShareConfig)
    case 'PartnerModel':
      return validatePartnerModel(model.config as PartnerModelConfig)
    default:
      return [`Unknown rent model type: ${(model as RentModel).type}`]
  }
}
