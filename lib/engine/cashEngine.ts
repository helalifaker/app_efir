// lib/engine/cashEngine.ts
// Iterative Cash Convergence Engine
//
// This engine performs 2-3 pass convergence to balance:
// - Cash Flow (Operating + Investing + Financing) = Change in Cash
// - Balance Sheet (Assets = Liabilities + Equity)
// - Cash in Balance Sheet = Cash Ending from Cash Flow
//
// Algorithm:
// 1. Pass 1: Calculate CF from P&L and BS inputs
// 2. Pass 2: Adjust BS cash to match CF cash_ending
// 3. Pass 3: Verify convergence (repeat if needed, up to maxIterations)

import { Year, ConvergenceStatus } from '@/types';
import { calculateAllMetrics, calculateInterestFromCash } from './metricsCalculator';
import { getServiceClient } from '@/lib/supabaseServer';
// getAdminConfig is available but not used in this file
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================
export type CashEngineInput = Record<string, number | null>;
export type CashEngineOutput = {
  metrics: Record<string, number | null>;
  convergence: ConvergenceStatus;
};

export type CashEngineConfig = {
  maxIterations: number;
  tolerance: number;
  convergenceCheck: 'bs_cf_balance' | 'cash_balance';
};

// ============================================================================
// CONVERGENCE CHECKS
// ============================================================================

/**
 * Check balance sheet balance: Assets = Liabilities + Equity
 */
function checkBalanceSheetBalance(metrics: CashEngineInput): {
  balanced: boolean;
  difference: number;
  error?: string;
} {
  const assets = metrics.assets ?? 0;
  const liabilities = metrics.liabilities ?? 0;
  const equity = metrics.equity ?? 0;

  const calculatedEquity = assets - liabilities;
  const difference = Math.abs(calculatedEquity - equity);

  return {
    balanced: difference < 0.01, // Small tolerance for floating point
    difference,
    error: difference >= 0.01 ? `BS imbalance: ${difference.toFixed(2)}` : undefined,
  };
}

/**
 * Check cash balance: Cash in BS = Cash Ending from CF
 */
function checkCashBalance(metrics: CashEngineInput): {
  balanced: boolean;
  difference: number;
  error?: string;
} {
  const cashBs = metrics.cash ?? null;
  const cashEnding = metrics.cash_ending ?? null;

  if (cashBs === null || cashEnding === null) {
    return {
      balanced: false,
      difference: Infinity,
      error: 'Cash or cash_ending is null',
    };
  }

  const difference = Math.abs(cashBs - cashEnding);

  return {
    balanced: difference < 0.01,
    difference,
    error: difference >= 0.01 ? `Cash imbalance: ${difference.toFixed(2)}` : undefined,
  };
}

// ============================================================================
// CASH ENGINE - SINGLE YEAR
// ============================================================================

/**
 * Run cash convergence for a single year
 * 
 * This function iteratively adjusts cash and balance sheet items
 * until convergence is achieved (or maxIterations reached).
 */
export async function runCashEngineForYear(
  year: Year,
  inputMetrics: CashEngineInput,
  previousYearMetrics: CashEngineInput | undefined,
  config: CashEngineConfig
): Promise<CashEngineOutput> {
  let currentMetrics = { ...inputMetrics };
  let converged = false;
  let iterations = 0;
  const checks: ConvergenceStatus['checks'] = [];
  let lastError = Infinity;

  while (iterations < config.maxIterations && !converged) {
    iterations++;

    // Calculate interest income/expense from cash balance (if not already set)
    if (currentMetrics.interest_income === null && currentMetrics.interest_expense === null) {
      const interest = await calculateInterestFromCash(
        currentMetrics.cash_beginning ?? null,
        currentMetrics.cash_ending ?? null,
        year
      );
      currentMetrics.interest_income = interest.interest_income;
      currentMetrics.interest_expense = interest.interest_expense;
    }

    // Calculate derived metrics
    const derived = await calculateAllMetrics(currentMetrics, year, previousYearMetrics);
    currentMetrics = { ...currentMetrics, ...derived };

    // Run convergence checks
    const bsCheck = checkBalanceSheetBalance(currentMetrics);
    const cashCheck = checkCashBalance(currentMetrics);

    checks.push(
      {
        check: 'balance_sheet',
        passed: bsCheck.balanced,
        value: bsCheck.difference,
        target: 0,
      },
      {
        check: 'cash_balance',
        passed: cashCheck.balanced,
        value: cashCheck.difference,
        target: 0,
      }
    );

    // Determine if converged based on config
    if (config.convergenceCheck === 'bs_cf_balance') {
      converged = bsCheck.balanced && cashCheck.balanced;
      lastError = Math.max(bsCheck.difference, cashCheck.difference);
    } else {
      converged = cashCheck.balanced;
      lastError = cashCheck.difference;
    }

    if (converged) {
      break;
    }

    // Adjust metrics for next iteration
    // Strategy: Adjust cash in balance sheet to match cash_ending from CF
    if (!cashCheck.balanced && cashCheck.difference < Infinity) {
      const cashEnding = currentMetrics.cash_ending ?? null;
      if (cashEnding !== null) {
        currentMetrics.cash = cashEnding;
        
        // If cash is part of current assets, adjust current assets proportionally
        if (currentMetrics.assets_current !== null && currentMetrics.cash !== null) {
          // Keep other current assets the same, adjust total
          const otherCurrentAssets = (currentMetrics.assets_current ?? 0) - (currentMetrics.cash ?? 0);
          currentMetrics.assets_current = otherCurrentAssets + cashEnding;
        }
      }
    }

    // Adjust balance sheet if needed
    if (!bsCheck.balanced) {
      const assets = currentMetrics.assets ?? 0;
      const liabilities = currentMetrics.liabilities ?? 0;
      const calculatedEquity = assets - liabilities;
      
      // Adjust equity to match calculated value
      if (currentMetrics.equity !== null) {
        currentMetrics.equity = calculatedEquity;
      }
    }
  }

  const convergence: ConvergenceStatus = {
    converged,
    iterations,
    maxIterations: config.maxIterations,
    tolerance: config.tolerance,
    lastError: converged ? undefined : lastError,
    checks,
  };

  return {
    metrics: currentMetrics,
    convergence,
  };
}

// ============================================================================
// CASH ENGINE - MULTI-YEAR (2025-2052)
// ============================================================================

/**
 * Run cash convergence for multiple years sequentially
 * 
 * Each year uses the previous year's results as input.
 * This ensures proper cumulative calculations (e.g., retained earnings).
 */
export async function runCashEngineForYears(
  startYear: Year,
  endYear: Year,
  inputMetricsByYear: Record<Year, CashEngineInput>,
  config: CashEngineConfig
): Promise<Record<Year, CashEngineOutput>> {
  const results: Partial<Record<Year, CashEngineOutput>> = {};
  let previousYearMetrics: CashEngineInput | undefined;

  for (let year = startYear; year <= endYear; year++) {
    const inputMetrics = inputMetricsByYear[year] || {};
    const result = await runCashEngineForYear(year, inputMetrics, previousYearMetrics, config);
    results[year] = result;

    // Use converged metrics as input for next year
    previousYearMetrics = result.metrics;
  }

  return results as Record<Year, CashEngineOutput>;
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Cache convergence results in version_computed table
 */
export async function cacheConvergenceResults(
  versionId: string,
  results: Record<Year, CashEngineOutput>
): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await supabase
    .from('version_computed')
    .upsert({
      version_id: versionId,
      computed_key: 'cash_engine_convergence',
      computed_value: results,
      computed_at: new Date().toISOString(),
    }, {
      onConflict: 'version_id,computed_key',
    });

  if (error) {
    logger.error('Failed to cache convergence results', error, { versionId, operation: 'cache_convergence' });
    throw error;
  }
}

/**
 * Get cached convergence results
 */
export async function getCachedConvergenceResults(
  versionId: string
): Promise<Record<Year, CashEngineOutput> | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('version_computed')
    .select('computed_value')
    .eq('version_id', versionId)
    .eq('computed_key', 'cash_engine_convergence')
    .single();

  if (error || !data) {
    return null;
  }

  return data.computed_value as Record<Year, CashEngineOutput>;
}
