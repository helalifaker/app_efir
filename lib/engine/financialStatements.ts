/**
 * Financial Statements Calculator
 * Enhanced calculations for School Relocation Planner
 * Includes COGS, Accounts Receivable, Accounts Payable, Deferred Revenue
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FinancialStatementConfig {
  dsoDays: number // Days Sales Outstanding
  dpoDays: number // Days Payable Outstanding
  deferredRevenuePct: number // e.g., 0.35 for 35%
}

export interface COGSComponents {
  staffCosts: number
  rent: number
  otherOpex: number
  totalCOGS: number
}

export interface WorkingCapital {
  accountsReceivable: number
  accountsPayable: number
  deferredRevenue: number
  netWorkingCapital: number
}

export interface BalanceSheetItems {
  // Assets
  cashOnHand: number
  accountsReceivable: number
  totalCurrentAssets: number
  tangibleAssets: number
  accumulatedDepreciation: number
  netFixedAssets: number
  totalAssets: number

  // Liabilities
  accountsPayable: number
  deferredIncome: number
  totalCurrentLiabilities: number
  provisions: number
  totalLiabilities: number

  // Equity
  retainedEarnings: number
  netResult: number
  totalEquity: number
}

export interface CashFlowItems {
  // Operating Activities
  netResult: number
  depreciation: number
  accountsReceivableChange: number
  accountsPayableChange: number
  deferredIncomeChange: number
  provisionsChange: number
  netCashFromOperating: number

  // Investing Activities
  capexAdditions: number
  netCashFromInvesting: number

  // Financing Activities
  financingActivities: number
  netCashFromFinancing: number

  // Summary
  netCashFlowForYear: number
  cashAtBeginningOfYear: number
  cashAtEndOfYear: number
}

// ============================================================================
// COGS CALCULATION
// ============================================================================

/**
 * Calculate Cost of Goods Sold (COGS)
 *
 * Formula: COGS = Staff Costs + Rent + Other Operating Expenses
 *
 * This is a key change for School Relocation Planner.
 * COGS includes all operating costs, not just direct costs.
 */
export function calculateCOGS(
  staffCosts: number,
  rent: number,
  otherOpex: number
): COGSComponents {
  return {
    staffCosts,
    rent,
    otherOpex,
    totalCOGS: staffCosts + rent + otherOpex
  }
}

// ============================================================================
// ACCOUNTS RECEIVABLE CALCULATION
// ============================================================================

/**
 * Calculate Accounts Receivable using DSO (Days Sales Outstanding)
 *
 * Formula: AR = (Revenue × DSO) / 365
 *
 * DSO represents the average number of days it takes to collect payment
 * Example: DSO=30 means customers pay within 30 days on average
 */
export function calculateAccountsReceivable(
  revenue: number,
  dsoDays: number
): number {
  return (revenue * dsoDays) / 365
}

// ============================================================================
// ACCOUNTS PAYABLE CALCULATION
// ============================================================================

/**
 * Calculate Accounts Payable using DPO (Days Payable Outstanding)
 *
 * Formula: AP = (COGS × DPO) / 365
 *
 * DPO represents the average number of days it takes to pay suppliers
 * Example: DPO=45 means school pays suppliers within 45 days on average
 *
 * Note: Uses COGS (not just purchases) as the base
 */
export function calculateAccountsPayable(
  cogs: number,
  dpoDays: number
): number {
  return (cogs * dpoDays) / 365
}

// ============================================================================
// DEFERRED REVENUE CALCULATION
// ============================================================================

/**
 * Calculate Deferred Revenue
 *
 * Formula: Deferred Revenue = Revenue × deferred_revenue_pct
 *
 * Represents tuition received in advance (not yet earned)
 * Example: 35% of annual tuition collected before year starts
 */
export function calculateDeferredRevenue(
  revenue: number,
  deferredPct: number
): number {
  return revenue * deferredPct
}

// ============================================================================
// WORKING CAPITAL CALCULATION
// ============================================================================

/**
 * Calculate Working Capital components
 *
 * Net Working Capital = AR - AP - Deferred Revenue
 * (Simplified: excludes inventory and other current items)
 */
export function calculateWorkingCapital(
  revenue: number,
  cogs: number,
  config: FinancialStatementConfig
): WorkingCapital {
  const accountsReceivable = calculateAccountsReceivable(revenue, config.dsoDays)
  const accountsPayable = calculateAccountsPayable(cogs, config.dpoDays)
  const deferredRevenue = calculateDeferredRevenue(revenue, config.deferredRevenuePct)

  const netWorkingCapital = accountsReceivable - accountsPayable - deferredRevenue

  return {
    accountsReceivable,
    accountsPayable,
    deferredRevenue,
    netWorkingCapital
  }
}

// ============================================================================
// BALANCE SHEET CALCULATION
// ============================================================================

export interface BalanceSheetParams {
  // Prior year values
  priorCash: number
  priorAR: number
  priorAP: number
  priorDeferredIncome: number
  priorProvisions: number
  priorRetainedEarnings: number

  // Current year values
  revenue: number
  cogs: number
  capex: number
  depreciation: number
  netResult: number
  cashFlowFromOperations: number
  cashFlowFromInvesting: number
  cashFlowFromFinancing: number

  // Configuration
  config: FinancialStatementConfig

  // Fixed assets (cumulative)
  tangibleAssets: number
  accumulatedDepreciation: number
}

/**
 * Calculate Balance Sheet items
 */
export function calculateBalanceSheet(
  params: BalanceSheetParams
): BalanceSheetItems {
  const { revenue, cogs, netResult, config, priorCash, priorRetainedEarnings } = params

  // Working capital
  const wc = calculateWorkingCapital(revenue, cogs, config)

  // Cash calculation
  const cashAtEndOfYear = priorCash +
    params.cashFlowFromOperations +
    params.cashFlowFromInvesting +
    params.cashFlowFromFinancing

  // Assets
  const totalCurrentAssets = cashAtEndOfYear + wc.accountsReceivable
  const netFixedAssets = params.tangibleAssets - params.accumulatedDepreciation
  const totalAssets = totalCurrentAssets + netFixedAssets

  // Liabilities
  const totalCurrentLiabilities = wc.accountsPayable + wc.deferredRevenue
  const totalLiabilities = totalCurrentLiabilities + params.priorProvisions

  // Equity
  const retainedEarnings = priorRetainedEarnings + netResult
  const totalEquity = retainedEarnings

  return {
    // Assets
    cashOnHand: cashAtEndOfYear,
    accountsReceivable: wc.accountsReceivable,
    totalCurrentAssets,
    tangibleAssets: params.tangibleAssets,
    accumulatedDepreciation: params.accumulatedDepreciation,
    netFixedAssets,
    totalAssets,

    // Liabilities
    accountsPayable: wc.accountsPayable,
    deferredIncome: wc.deferredRevenue,
    totalCurrentLiabilities,
    provisions: params.priorProvisions,
    totalLiabilities,

    // Equity
    retainedEarnings,
    netResult,
    totalEquity
  }
}

// ============================================================================
// CASH FLOW CALCULATION
// ============================================================================

export interface CashFlowParams {
  // P&L items
  netResult: number
  depreciation: number

  // Balance sheet changes (current year - prior year)
  priorAR: number
  currentAR: number
  priorAP: number
  currentAP: number
  priorDeferredIncome: number
  currentDeferredIncome: number
  priorProvisions: number
  currentProvisions: number

  // Investing
  capexAdditions: number

  // Financing
  financingActivities: number

  // Prior cash
  cashAtBeginningOfYear: number
}

/**
 * Calculate Cash Flow Statement
 */
export function calculateCashFlow(
  params: CashFlowParams
): CashFlowItems {
  // Changes in balance sheet items
  const accountsReceivableChange = params.currentAR - params.priorAR
  const accountsPayableChange = params.currentAP - params.priorAP
  const deferredIncomeChange = params.currentDeferredIncome - params.priorDeferredIncome
  const provisionsChange = params.currentProvisions - params.priorProvisions

  // Operating cash flow
  // Note: Increases in AR decrease cash (outflow)
  //       Increases in AP increase cash (inflow)
  //       Increases in Deferred Income increase cash (inflow)
  const netCashFromOperating =
    params.netResult +
    params.depreciation -
    accountsReceivableChange +
    accountsPayableChange +
    deferredIncomeChange +
    provisionsChange

  // Investing cash flow (negative for capex additions)
  const netCashFromInvesting = -params.capexAdditions

  // Financing cash flow
  const netCashFromFinancing = params.financingActivities

  // Total cash flow
  const netCashFlowForYear =
    netCashFromOperating +
    netCashFromInvesting +
    netCashFromFinancing

  const cashAtEndOfYear = params.cashAtBeginningOfYear + netCashFlowForYear

  return {
    netResult: params.netResult,
    depreciation: params.depreciation,
    accountsReceivableChange,
    accountsPayableChange,
    deferredIncomeChange,
    provisionsChange,
    netCashFromOperating,
    capexAdditions: params.capexAdditions,
    netCashFromInvesting,
    financingActivities: params.financingActivities,
    netCashFromFinancing,
    netCashFlowForYear,
    cashAtBeginningOfYear: params.cashAtBeginningOfYear,
    cashAtEndOfYear
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate financial statement configuration
 */
export function validateFinancialConfig(
  config: FinancialStatementConfig
): string[] {
  const errors: string[] = []

  if (config.dsoDays < 0 || config.dsoDays > 365) {
    errors.push('DSO days must be between 0 and 365')
  }

  if (config.dpoDays < 0 || config.dpoDays > 365) {
    errors.push('DPO days must be between 0 and 365')
  }

  if (config.deferredRevenuePct < 0 || config.deferredRevenuePct > 1) {
    errors.push('Deferred revenue % must be between 0 and 1 (e.g., 0.35 for 35%)')
  }

  return errors
}

/**
 * Validate balance sheet balances
 * Assets must equal Liabilities + Equity
 */
export function validateBalanceSheet(
  bs: BalanceSheetItems,
  tolerance: number = 0.01
): { balanced: boolean; difference: number } {
  const difference = Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity))
  const balanced = difference <= tolerance

  return { balanced, difference }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate EBITDA
 * Formula: Revenue - COGS - Opex (excluding Depreciation)
 */
export function calculateEBITDA(
  revenue: number,
  cogs: number,
  otherOpex: number
): number {
  return revenue - cogs - otherOpex
}

/**
 * Calculate EBIT
 * Formula: EBITDA - Depreciation
 */
export function calculateEBIT(
  ebitda: number,
  depreciation: number
): number {
  return ebitda - depreciation
}

/**
 * Calculate Net Income
 * Formula: EBIT + Interest Income - Interest Expense - Taxes
 */
export function calculateNetIncome(
  ebit: number,
  interestIncome: number,
  interestExpense: number,
  taxes: number
): number {
  return ebit + interestIncome - interestExpense - taxes
}

/**
 * Calculate EBITDA Margin %
 */
export function calculateEBITDAMargin(
  ebitda: number,
  revenue: number
): number {
  if (revenue === 0) return 0
  return (ebitda / revenue) * 100
}

/**
 * Calculate Net Margin %
 */
export function calculateNetMargin(
  netIncome: number,
  revenue: number
): number {
  if (revenue === 0) return 0
  return (netIncome / revenue) * 100
}

/**
 * Calculate Current Ratio
 * Formula: Current Assets / Current Liabilities
 */
export function calculateCurrentRatio(
  currentAssets: number,
  currentLiabilities: number
): number {
  if (currentLiabilities === 0) return Infinity
  return currentAssets / currentLiabilities
}

/**
 * Calculate Days in Working Capital
 * Formula: (Net Working Capital / Revenue) × 365
 */
export function calculateDaysInWorkingCapital(
  netWorkingCapital: number,
  revenue: number
): number {
  if (revenue === 0) return 0
  return (netWorkingCapital / revenue) * 365
}
