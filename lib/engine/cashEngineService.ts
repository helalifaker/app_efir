// lib/engine/cashEngineService.ts
// Cash Engine Service - Orchestrates full cash engine execution and persistence
//
// This service:
// 1. Loads input data from version_tabs (pnl, bs, cf)
// 2. Converts JSONB tab data to time-series metrics format
// 3. Runs cash engine for all forecast years (2025-2052)
// 4. Persists computed metrics to version_metrics table
// 5. Caches convergence results in version_computed table

import { getServiceClient } from '@/lib/supabaseServer';
import { getAdminConfig } from '@/lib/getAdminConfig';
import { runCashEngineForYears, cacheConvergenceResults, CashEngineInput, CashEngineOutput } from './cashEngine';
import { FORECAST_START, FORECAST_END, Year, MetricKey, HISTORY_YEARS } from '@/types';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export type CashEngineRunResult = {
  success: boolean;
  versionId: string;
  converged: boolean;
  totalIterations: number;
  yearsProcessed: number;
  errors?: string[];
  convergenceByYear?: Record<Year, {
    converged: boolean;
    iterations: number;
  }>;
};

// ============================================================================
// DATA EXTRACTION FROM VERSION_TABS
// ============================================================================

/**
 * Extract metrics from version_tabs JSONB data
 * Maps tab data to time-series metrics format
 */
function extractMetricsFromTabs(tabs: {
  pnl?: { data: Record<string, unknown> };
  bs?: { data: Record<string, unknown> };
  cf?: { data: Record<string, unknown> };
}): CashEngineInput {
  const pnlData = tabs.pnl?.data || {};
  const bsData = tabs.bs?.data || {};
  const cfData = tabs.cf?.data || {};

  // Map tab JSONB fields to metric keys
  return {
    // P&L metrics
    revenue: (typeof pnlData.revenue === 'number' ? pnlData.revenue : null),
    students_count: (typeof pnlData.students_count === 'number' ? pnlData.students_count : null),
    avg_tuition_fee: (typeof pnlData.avg_tuition_fee === 'number' ? pnlData.avg_tuition_fee : null),
    other_income: typeof pnlData.other_income === 'object' && !Array.isArray(pnlData.other_income) && pnlData.other_income !== null
      ? Object.values(pnlData.other_income).reduce((sum: number, val: unknown) => sum + (typeof val === 'number' ? val : 0), 0) 
      : (typeof pnlData.other_income === 'number' ? pnlData.other_income : null),
    cost_of_sales: (typeof pnlData.cost_of_sales === 'number' ? pnlData.cost_of_sales : null),
    operating_expenses: (typeof pnlData.operating_expenses === 'number' ? pnlData.operating_expenses : null),
    depreciation: (typeof pnlData.depreciation === 'number' ? pnlData.depreciation : null),
    interest_income: (typeof pnlData.interest_income === 'number' ? pnlData.interest_income : null),
    interest_expense: (typeof pnlData.interest_expense === 'number' ? pnlData.interest_expense : null),
    
    // Balance Sheet metrics
    assets_current: (typeof bsData.assets_current === 'number' ? bsData.assets_current : null),
    cash: (typeof bsData.cash === 'number' ? bsData.cash : null),
    receivables: (typeof bsData.receivables === 'number' ? bsData.receivables : null),
    assets_fixed: (typeof bsData.assets_fixed === 'number' ? bsData.assets_fixed : null),
    liabilities_current: (typeof bsData.liabilities_current === 'number' ? bsData.liabilities_current : null),
    debt: (typeof bsData.debt === 'number' ? bsData.debt : null),
    
    // Cash Flow metrics
    cf_operating: (typeof cfData.operating === 'number' ? cfData.operating : null) ?? 
      ((typeof cfData.operating_cash_in === 'number' && typeof cfData.operating_cash_out === 'number')
      ? (cfData.operating_cash_in - cfData.operating_cash_out) 
      : null),
    cf_investing: (typeof cfData.investing === 'number' ? cfData.investing : null) ?? 
      ((typeof cfData.investing_cash_in === 'number' && typeof cfData.investing_cash_out === 'number')
      ? (cfData.investing_cash_in - cfData.investing_cash_out)
      : null),
    cf_financing: (typeof cfData.financing === 'number' ? cfData.financing : null) ?? 
      ((typeof cfData.financing_cash_in === 'number' && typeof cfData.financing_cash_out === 'number')
      ? (cfData.financing_cash_in - cfData.financing_cash_out)
      : null),
    cash_beginning: (typeof cfData.beginning_cash === 'number' ? cfData.beginning_cash : null),
  };
}

/**
 * Load input data for all years from version_tabs
 * For now, we use the same input for all forecast years (2025-2052)
 * In the future, this could load year-specific data from version_metrics
 */
async function loadInputDataForYears(versionId: string): Promise<Record<Year, CashEngineInput>> {
  const supabase = getServiceClient();

  // Fetch tabs for this version
  const { data: tabs, error } = await supabase
    .from('version_tabs')
    .select('tab, data')
    .eq('version_id', versionId)
    .in('tab', ['pnl', 'bs', 'cf']);

  if (error) {
    logger.error('Failed to load tabs for cash engine', error, { versionId });
    throw new Error(`Failed to load tabs: ${error.message}`);
  }

  // Organize tabs by type
  const tabsByType: {
    pnl?: { data: Record<string, unknown> };
    bs?: { data: Record<string, unknown> };
    cf?: { data: Record<string, unknown> };
  } = {};
  (tabs || []).forEach((tab: { tab: string; data: Record<string, unknown> }) => {
    if (tab.tab === 'pnl' || tab.tab === 'bs' || tab.tab === 'cf') {
      tabsByType[tab.tab] = { data: tab.data };
    }
  });

  // Extract base metrics from tabs
  const baseMetrics = extractMetricsFromTabs(tabsByType);

  // For now, use same input for all forecast years
  // In the future, this could load year-specific forecasts from version_metrics
  const inputByYear: Partial<Record<Year, CashEngineInput>> = {};
  
  for (let year = FORECAST_START; year <= FORECAST_END; year++) {
    inputByYear[year] = { ...baseMetrics };
  }

  return inputByYear as Record<Year, CashEngineInput>;
}

// ============================================================================
// PERSIST METRICS TO VERSION_METRICS
// ============================================================================

/**
 * Persist computed metrics to version_metrics table
 * This is the single source of truth for time-series data
 */
async function persistMetricsToVersionMetrics(
  versionId: string,
  results: Record<Year, CashEngineOutput>
): Promise<void> {
  const supabase = getServiceClient();

  // Build metrics to upsert
  const metricsToUpsert: Array<{
    version_id: string;
    year: number;
    metric_key: string;
    value: number | null;
    is_historical: boolean;
  }> = [];

  // Define which metrics to persist
  const metricsToPersist: MetricKey[] = [
    // P&L
    'revenue',
    'gross_profit',
    'ebitda',
    'ebit',
    'net_income',
    // Balance Sheet
    'assets',
    'assets_current',
    'cash',
    'receivables',
    'assets_fixed',
    'liabilities',
    'liabilities_current',
    'debt',
    'equity',
    'retained_earnings',
    // Cash Flow
    'cf_operating',
    'cf_investing',
    'cf_financing',
    'cf_net_change',
    'cash_beginning',
    'cash_ending',
  ];

  // Extract metrics from each year's results
  for (const [yearStr, result] of Object.entries(results)) {
    const year = parseInt(yearStr, 10) as Year;
    const isHistorical = (HISTORY_YEARS as readonly number[]).includes(year);

    for (const metricKey of metricsToPersist) {
      const value = result.metrics[metricKey] ?? null;
      
      metricsToUpsert.push({
        version_id: versionId,
        year,
        metric_key: metricKey,
        value,
        is_historical: isHistorical,
      });
    }
  }

  // Batch upsert (in chunks of 100 for performance)
  const chunkSize = 100;
  for (let i = 0; i < metricsToUpsert.length; i += chunkSize) {
    const chunk = metricsToUpsert.slice(i, i + chunkSize);
    
    const { error } = await supabase
      .from('version_metrics')
      .upsert(chunk, {
        onConflict: 'version_id,year,metric_key',
      });

    if (error) {
      logger.error('Failed to persist metrics', error, { 
        versionId, 
        chunkIndex: i / chunkSize + 1,
        chunkSize: chunk.length 
      });
      throw new Error(`Failed to persist metrics: ${error.message}`);
    }
  }

  logger.info('Metrics persisted successfully', { 
    versionId, 
    totalMetrics: metricsToUpsert.length,
    yearsProcessed: Object.keys(results).length 
  });
}

// ============================================================================
// MAIN CASH ENGINE SERVICE
// ============================================================================

/**
 * Run cash engine for a version and persist results
 * This is the main entry point for cash engine execution
 */
export async function runCashEngineForVersion(
  versionId: string,
  options?: {
    forceRecalculation?: boolean;
    yearRange?: { start: Year; end: Year };
  }
): Promise<CashEngineRunResult> {
  try {
    logger.info('Starting cash engine execution', { versionId, options });

    // 1. Get admin config for cash engine settings
    const adminConfig = await getAdminConfig();
    const cashEngineConfig = adminConfig.cashEngine || {
      maxIterations: 3,
      tolerance: 0.01,
      convergenceCheck: 'bs_cf_balance' as const,
    };

    // 2. Check cache if not forcing recalculation
    if (!options?.forceRecalculation) {
      const supabase = getServiceClient();
      const { data: cached } = await supabase
        .from('version_computed')
        .select('computed_value, computed_at')
        .eq('version_id', versionId)
        .eq('computed_key', 'cash_engine_convergence')
        .single();

      if (cached) {
        logger.info('Using cached cash engine results', { versionId, computedAt: cached.computed_at });
        const results = cached.computed_value as Record<Year, CashEngineOutput>;
        
        // Check if any year didn't converge
        const allConverged = Object.values(results).every(r => r.convergence.converged);
        const totalIterations = Object.values(results).reduce((sum, r) => sum + r.convergence.iterations, 0);

        return {
          success: true,
          versionId,
          converged: allConverged,
          totalIterations,
          yearsProcessed: Object.keys(results).length,
          convergenceByYear: Object.fromEntries(
            Object.entries(results).map(([year, result]) => [
              year,
              {
                converged: result.convergence.converged,
                iterations: result.convergence.iterations,
              },
            ])
          ),
        };
      }
    }

    // 3. Load input data for all years
    const inputByYear = await loadInputDataForYears(versionId);

    // 4. Determine year range
    const startYear = options?.yearRange?.start || FORECAST_START;
    const endYear = options?.yearRange?.end || FORECAST_END;

    // Filter input data to year range
    const filteredInput: Partial<Record<Year, CashEngineInput>> = {};
    for (let year = startYear; year <= endYear; year++) {
      filteredInput[year] = inputByYear[year] || {};
    }

    // 5. Run cash engine for all years
    const results = await runCashEngineForYears(
      startYear,
      endYear,
      filteredInput as Record<Year, CashEngineInput>,
      {
        maxIterations: cashEngineConfig.maxIterations,
        tolerance: cashEngineConfig.tolerance,
        convergenceCheck: cashEngineConfig.convergenceCheck,
      }
    );

    // 6. Persist metrics to version_metrics
    await persistMetricsToVersionMetrics(versionId, results);

    // 7. Cache convergence results
    await cacheConvergenceResults(versionId, results);

    // 8. Calculate summary statistics
    const allConverged = Object.values(results).every(r => r.convergence.converged);
    const totalIterations = Object.values(results).reduce((sum, r) => sum + r.convergence.iterations, 0);
    const convergenceByYear: Record<Year, { converged: boolean; iterations: number }> = {};
    
    for (const [year, result] of Object.entries(results)) {
      convergenceByYear[parseInt(year, 10) as Year] = {
        converged: result.convergence.converged,
        iterations: result.convergence.iterations,
      };
    }

    logger.info('Cash engine execution completed', {
      versionId,
      converged: allConverged,
      totalIterations,
      yearsProcessed: Object.keys(results).length,
    });

    return {
      success: true,
      versionId,
      converged: allConverged,
      totalIterations,
      yearsProcessed: Object.keys(results).length,
      convergenceByYear,
    };
  } catch (error) {
    logger.error('Cash engine execution failed', error, { versionId });
    return {
      success: false,
      versionId,
      converged: false,
      totalIterations: 0,
      yearsProcessed: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

