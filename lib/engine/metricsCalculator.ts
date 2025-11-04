// lib/engine/metricsCalculator.ts
// Pure functions for calculating derived metrics from time-series data
//
// Functions:
// - calculatePnlMetrics: Revenue, COGS, Gross Profit, EBITDA, EBIT, Net Income
// - calculateProvisionMetrics: Operational and contingency provisions
// - calculateBalanceSheetMetrics: Assets, Liabilities, Equity, Retained Earnings
// - calculateCashFlowMetrics: Operating, Investing, Financing CF

import { Year, MetricKey } from '@/types';
// getSettings is available but not used in this file
import { getAdminConfig } from '@/lib/getAdminConfig';

// ============================================================================
// TYPES
// ============================================================================
export type MetricsInput = Record<string, number | null>;
export type MetricsOutput = Record<string, number | null>;

// ============================================================================
// P&L METRICS CALCULATOR
// ============================================================================
/**
 * Calculate P&L metrics from input data
 * 
 * Input metrics:
 * - revenue, students_count, avg_tuition_fee, other_income
 * - cost_of_sales, operating_expenses
 * - depreciation, interest_income, interest_expense
 * 
 * Calculated metrics:
 * - gross_profit = revenue - cost_of_sales
 * - ebitda = gross_profit - operating_expenses
 * - ebit = ebitda - depreciation
 * - net_income = ebit + interest_income - interest_expense
 */
export function calculatePnlMetrics(input: MetricsInput, _year: Year): MetricsOutput {
  const revenue = input.revenue ?? null;
  const costOfSales = input.cost_of_sales ?? null;
  const operatingExpenses = input.operating_expenses ?? null;
  const depreciation = input.depreciation ?? null;
  const interestIncome = input.interest_income ?? null;
  const interestExpense = input.interest_expense ?? null;

  // Gross Profit = Revenue - Cost of Sales
  const grossProfit = revenue !== null && costOfSales !== null
    ? revenue - costOfSales
    : null;

  // EBITDA = Gross Profit - Operating Expenses
  const ebitda = grossProfit !== null && operatingExpenses !== null
    ? grossProfit - operatingExpenses
    : null;

  // EBIT = EBITDA - Depreciation
  const ebit = ebitda !== null && depreciation !== null
    ? ebitda - depreciation
    : ebitda; // If depreciation is null, EBIT = EBITDA

  // Net Income = EBIT + Interest Income - Interest Expense
  const netIncome = ebit !== null
    ? ebit + (interestIncome ?? 0) - (interestExpense ?? 0)
    : null;

  return {
    gross_profit: grossProfit,
    ebitda,
    ebit,
    net_income: netIncome,
  };
}

/**
 * Calculate interest income/expense from average cash balance
 * Uses admin config deposit_rate and overdraft_rate
 * 
 * @param cashBeginning - Beginning cash balance
 * @param cashEnding - Ending cash balance
 * @param year - Year for calculation
 * @returns Interest income (positive) and interest expense (negative)
 */
export async function calculateInterestFromCash(
  cashBeginning: number | null,
  cashEnding: number | null,
  _year: Year
): Promise<{ interest_income: number | null; interest_expense: number | null }> {
  const adminConfig = await getAdminConfig();
  const cashEngineConfig = adminConfig.cashEngine || {};
  const depositRate = cashEngineConfig.depositRate ?? 0.05; // 5% default
  const overdraftRate = cashEngineConfig.overdraftRate ?? 0.12; // 12% default

  if (cashBeginning === null || cashEnding === null) {
    return { interest_income: null, interest_expense: null };
  }

  // Average cash balance for the year
  const averageCash = (cashBeginning + cashEnding) / 2;

  // Interest income from positive cash (deposits)
  const interestIncome = averageCash > 0 
    ? averageCash * depositRate 
    : 0;

  // Interest expense from negative cash (overdraft)
  const interestExpense = averageCash < 0 
    ? Math.abs(averageCash) * overdraftRate 
    : 0;

  return {
    interest_income: interestIncome > 0 ? interestIncome : null,
    interest_expense: interestExpense > 0 ? interestExpense : null,
  };
}

// ============================================================================
// PROVISION METRICS CALCULATOR
// ============================================================================
/**
 * Calculate provision metrics (operational and contingency)
 * 
 * Operational provision: Based on revenue/expenses (configurable %)
 * Contingency provision: Based on net income or revenue (configurable %)
 * 
 * Uses admin config for provision rates (if available)
 */
export async function calculateProvisionMetrics(
  input: MetricsInput,
  _year: Year
): Promise<MetricsOutput> {
  const revenue = input.revenue ?? null;
  const netIncome = input.net_income ?? null;
  const operatingExpenses = input.operating_expenses ?? null;

  // Default provision rates (can be overridden by admin config)
  const operationalProvisionRate = 0.02; // 2% of operating expenses
  const contingencyProvisionRate = 0.05; // 5% of net income or revenue

  // Operational Provision = % of operating expenses
  const provisionOperational = operatingExpenses !== null
    ? operatingExpenses * operationalProvisionRate
    : null;

  // Contingency Provision = % of net income (or revenue if net income unavailable)
  const contingencyBase = netIncome !== null ? netIncome : revenue;
  const provisionContingency = contingencyBase !== null
    ? contingencyBase * contingencyProvisionRate
    : null;

  return {
    provision_operational: provisionOperational,
    provision_contingency: provisionContingency,
  };
}

// ============================================================================
// BALANCE SHEET METRICS CALCULATOR
// ============================================================================
/**
 * Calculate balance sheet metrics
 * 
 * - assets = assets_current + assets_fixed
 * - liabilities = liabilities_current + debt
 * - equity = assets - liabilities (if assets and liabilities are known)
 * - retained_earnings: cumulative net income (requires previous year data)
 */
export function calculateBalanceSheetMetrics(
  input: MetricsInput,
  _year: Year,
  previousYearMetrics?: MetricsInput
): MetricsOutput {
  const assetsCurrent = input.assets_current ?? null;
  const assetsFixed = input.assets_fixed ?? null;
  const liabilitiesCurrent = input.liabilities_current ?? null;
  const debt = input.debt ?? null;
  const netIncome = input.net_income ?? null;

  // Total Assets = Current Assets + Fixed Assets
  const assets = assetsCurrent !== null && assetsFixed !== null
    ? assetsCurrent + assetsFixed
    : (assetsCurrent ?? assetsFixed);

  // Total Liabilities = Current Liabilities + Debt
  const liabilities = liabilitiesCurrent !== null && debt !== null
    ? liabilitiesCurrent + debt
    : (liabilitiesCurrent ?? debt);

  // Equity = Assets - Liabilities (if both are known)
  const equity = assets !== null && liabilities !== null
    ? assets - liabilities
    : null;

  // Retained Earnings = Previous Retained Earnings + Net Income
  const previousRetainedEarnings = previousYearMetrics?.retained_earnings ?? null;
  const retainedEarnings = previousRetainedEarnings !== null && netIncome !== null
    ? previousRetainedEarnings + netIncome
    : (previousRetainedEarnings ?? netIncome);

  return {
    assets,
    liabilities,
    equity,
    retained_earnings: retainedEarnings,
  };
}

// ============================================================================
// CASH FLOW METRICS CALCULATOR
// ============================================================================
/**
 * Calculate cash flow metrics
 * 
 * - cf_net_change = cf_operating + cf_investing + cf_financing
 * - cash_ending = cash_beginning + cf_net_change
 */
export function calculateCashFlowMetrics(
  input: MetricsInput,
  _year: Year,
  previousYearMetrics?: MetricsInput
): MetricsOutput {
  const cfOperating = input.cf_operating ?? null;
  const cfInvesting = input.cf_investing ?? null;
  const cfFinancing = input.cf_financing ?? null;
  const cashBeginning = input.cash_beginning ?? previousYearMetrics?.cash_ending ?? null;

  // Net Change = Operating + Investing + Financing
  const cfNetChange = 
    (cfOperating ?? 0) + 
    (cfInvesting ?? 0) + 
    (cfFinancing ?? 0);

  // Ending Cash = Beginning Cash + Net Change
  const cashEnding = cashBeginning !== null
    ? cashBeginning + cfNetChange
    : null;

  return {
    cf_net_change: cfNetChange !== 0 || (cfOperating !== null || cfInvesting !== null || cfFinancing !== null)
      ? cfNetChange
      : null,
    cash_ending: cashEnding,
  };
}

// ============================================================================
// COMPREHENSIVE METRICS CALCULATOR
// ============================================================================
/**
 * Calculate all derived metrics for a given year
 * 
 * This function orchestrates all metric calculations and returns
 * a comprehensive set of derived metrics.
 */
export async function calculateAllMetrics(
  input: MetricsInput,
  year: Year,
  previousYearMetrics?: MetricsInput
): Promise<MetricsOutput> {
  const pnlMetrics = calculatePnlMetrics(input, year);
  const provisionMetrics = await calculateProvisionMetrics(input, year);
  const bsMetrics = calculateBalanceSheetMetrics(input, year, previousYearMetrics);
  const cfMetrics = calculateCashFlowMetrics(input, year, previousYearMetrics);

  return {
    ...pnlMetrics,
    ...provisionMetrics,
    ...bsMetrics,
    ...cfMetrics,
  };
}

// ============================================================================
// HELPER: Check if metrics need recalculation
// ============================================================================
/**
 * Determine if metrics need to be recalculated based on input changes
 */
export function shouldRecalculateMetrics(
  currentInput: MetricsInput,
  previousInput: MetricsInput | undefined
): boolean {
  if (!previousInput) return true;

  // Check if any key input metrics have changed
  const keyMetrics: MetricKey[] = [
    'revenue',
    'cost_of_sales',
    'operating_expenses',
    'depreciation',
    'interest_income',
    'interest_expense',
    'assets_current',
    'assets_fixed',
    'liabilities_current',
    'debt',
    'cf_operating',
    'cf_investing',
    'cf_financing',
  ];

  for (const key of keyMetrics) {
    if (currentInput[key] !== previousInput[key]) {
      return true;
    }
  }

  return false;
}
