// lib/derive.ts
// Pure derivation functions for financial calculations

import { PnlTab, BsTab, CfTab } from './schemas/tabs';

/**
 * Derive P&L calculated fields from input data
 * Returns a new object with derived values
 */
export function derivePnl(data: Partial<PnlTab>): Partial<PnlTab> {
  const derived: Partial<PnlTab> = { ...data };
  
  // Gross Profit = Revenue - Cost of Sales
  if (typeof derived.revenue === 'number' && typeof derived.cost_of_sales === 'number') {
    derived.gross_profit = derived.revenue - derived.cost_of_sales;
  } else if (typeof derived.revenue === 'number' && typeof derived.gross_profit === 'number') {
    // Reverse: Cost of Sales = Revenue - Gross Profit
    if (typeof derived.cost_of_sales !== 'number') {
      derived.cost_of_sales = derived.revenue - derived.gross_profit;
    }
  }
  
  // EBITDA = EBIT + Depreciation + Amortization
  if (typeof derived.ebit === 'number') {
    const dep = typeof derived.depreciation === 'number' ? derived.depreciation : 0;
    const amort = typeof derived.amortization === 'number' ? derived.amortization : 0;
    derived.ebitda = derived.ebit + dep + amort;
  }
  
  // EBIT = Gross Profit - Operating Expenses
  if (typeof derived.gross_profit === 'number' && typeof derived.operating_expenses === 'number') {
    if (typeof derived.ebit !== 'number') {
      derived.ebit = derived.gross_profit - derived.operating_expenses;
    }
  }
  
  // Net Income = EBIT - Interest - Tax
  if (typeof derived.ebit === 'number') {
    const interest = typeof derived.interest_expense === 'number' ? derived.interest_expense : 0;
    const tax = typeof derived.tax_expense === 'number' ? derived.tax_expense : 0;
    if (typeof derived.net_income !== 'number') {
      derived.net_income = derived.ebit - interest - tax;
    }
  }
  
  // Margin percentage
  if (typeof derived.revenue === 'number' && derived.revenue > 0) {
    if (typeof derived.net_income === 'number') {
      derived.margin_percentage = (derived.net_income / derived.revenue) * 100;
    } else if (typeof derived.ebit === 'number') {
      derived.margin_percentage = (derived.ebit / derived.revenue) * 100;
    }
  }
  
  return derived;
}

/**
 * Derive Balance Sheet calculated fields
 * Returns a new object with derived values
 */
export function deriveBs(data: Partial<BsTab>): Partial<BsTab> {
  const derived: Partial<BsTab> = { ...data };
  
  // Total Assets = Current Assets + Fixed Assets
  if (typeof derived.assets_current === 'number' && typeof derived.assets_fixed === 'number') {
    derived.assets = derived.assets_current + derived.assets_fixed;
  } else if (typeof derived.assets === 'number') {
    // If we have total assets but not breakdown, try to derive from components
    if (typeof derived.cash === 'number' || typeof derived.receivables === 'number' || typeof derived.inventory === 'number') {
      const current = (typeof derived.cash === 'number' ? derived.cash : 0) +
                     (typeof derived.receivables === 'number' ? derived.receivables : 0) +
                     (typeof derived.inventory === 'number' ? derived.inventory : 0);
      if (current > 0) {
        derived.assets_current = current;
      }
    }
    
    if (typeof derived.property === 'number' || typeof derived.equipment === 'number') {
      const fixed = (typeof derived.property === 'number' ? derived.property : 0) +
                   (typeof derived.equipment === 'number' ? derived.equipment : 0);
      if (fixed > 0) {
        derived.assets_fixed = fixed;
      }
    }
  }
  
  // Total Liabilities = Current + Long-term
  if (typeof derived.liabilities_current === 'number' && typeof derived.liabilities_long_term === 'number') {
    derived.liabilities = derived.liabilities_current + derived.liabilities_long_term;
  }
  
  // Equity = Assets - Liabilities (if both are known)
  if (typeof derived.assets === 'number' && typeof derived.liabilities === 'number') {
    if (typeof derived.equity !== 'number') {
      derived.equity = derived.assets - derived.liabilities;
    }
  }
  
  return derived;
}

/**
 * Derive Cash Flow calculated fields
 * Returns a new object with derived values
 */
export function deriveCf(data: Partial<CfTab>): Partial<CfTab> {
  const derived: Partial<CfTab> = { ...data };
  
  // Operating = Operating Cash In - Operating Cash Out
  if (typeof derived.operating_cash_in === 'number' && typeof derived.operating_cash_out === 'number') {
    derived.operating = derived.operating_cash_in - derived.operating_cash_out;
  }
  
  // Investing = Investing Cash In - Investing Cash Out
  if (typeof derived.investing_cash_in === 'number' && typeof derived.investing_cash_out === 'number') {
    derived.investing = derived.investing_cash_in - derived.investing_cash_out;
  }
  
  // Financing = Financing Cash In - Financing Cash Out
  if (typeof derived.financing_cash_in === 'number' && typeof derived.financing_cash_out === 'number') {
    derived.financing = derived.financing_cash_in - derived.financing_cash_out;
  }
  
  // Net Change = Operating + Investing + Financing
  if (typeof derived.operating === 'number' || typeof derived.investing === 'number' || typeof derived.financing === 'number') {
    const op = typeof derived.operating === 'number' ? derived.operating : 0;
    const inv = typeof derived.investing === 'number' ? derived.investing : 0;
    const fin = typeof derived.financing === 'number' ? derived.financing : 0;
    derived.net_change = op + inv + fin;
  }
  
  // Ending Cash = Beginning Cash + Net Change
  if (typeof derived.beginning_cash === 'number' && typeof derived.net_change === 'number') {
    derived.ending_cash = derived.beginning_cash + derived.net_change;
  }
  
  return derived;
}

/**
 * Check if balance sheet balances
 * Returns { balanced: boolean, difference: number }
 */
export function checkBsBalance(data: Partial<BsTab>, tolerance: number = 0.01): {
  balanced: boolean;
  difference: number;
} {
  const assets = typeof data.assets === 'number' ? data.assets : 0;
  const equity = typeof data.equity === 'number' ? data.equity : 0;
  const liabilities = typeof data.liabilities === 'number' ? data.liabilities : 0;
  
  // Balance equation: Assets = Equity + Liabilities
  const expectedAssets = equity + liabilities;
  const difference = Math.abs(assets - expectedAssets);
  
  return {
    balanced: difference <= tolerance,
    difference,
  };
}

