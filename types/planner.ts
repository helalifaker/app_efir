// types/planner.ts
// TypeScript types for EFIR Financial Planner features

import { Year } from './index';

// ============================================================================
// SCENARIOS
// ============================================================================

export type ScenarioType = 'base' | 'optimistic' | 'pessimistic' | 'custom';

export interface Scenario {
  id: string;
  version_id: string;
  name: string;
  type: ScenarioType;
  description?: string;
  parent_scenario_id?: string;
  assumptions: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ScenarioWithStats extends Scenario {
  tab_count: number;
  driver_count: number;
  last_modified_by?: string;
}

// ============================================================================
// DRIVERS
// ============================================================================

export type DriverCategory = 'revenue' | 'cost' | 'growth' | 'operational' | 'financial' | 'custom';

export interface Driver {
  id: string;
  model_id: string;
  name: string;
  display_name: string;
  category: DriverCategory;
  unit?: string;
  formula?: string;
  description?: string;
  is_global: boolean;
  default_value?: number;
  min_value?: number;
  max_value?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type DriverValueSource = 'manual' | 'calculated' | 'imported' | 'forecasted';

export interface DriverValue {
  id: string;
  driver_id: string;
  scenario_id: string;
  year: Year;
  value: number;
  source?: DriverValueSource;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DriverWithValues extends Driver {
  values: DriverValue[];
}

// ============================================================================
// BUDGETS
// ============================================================================

export type BudgetStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'archived';

export interface Budget {
  id: string;
  model_id: string;
  name: string;
  fiscal_year: number;
  status: BudgetStatus;
  description?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetLine {
  id: string;
  budget_id: string;
  category: string;
  subcategory?: string;
  metric_key?: string;
  year: Year;
  budgeted_value: number;
  actual_value?: number;
  variance?: number; // Calculated: actual - budgeted
  variance_pct?: number; // Calculated: (variance / budgeted) * 100
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetWithLines extends Budget {
  lines: BudgetLine[];
  total_budgeted: number;
  total_actual: number;
  total_variance: number;
}

// ============================================================================
// COMMENTS & COLLABORATION
// ============================================================================

export type CommentEntityType = 'version' | 'scenario' | 'driver' | 'budget' | 'assumption';

export interface Comment {
  id: string;
  entity_type: CommentEntityType;
  entity_id: string;
  parent_comment_id?: string;
  user_id: string;
  content: string;
  mentions: string[]; // Array of user IDs
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CommentWithUser extends Comment {
  user_name: string;
  user_email: string;
  replies?: CommentWithUser[];
}

// ============================================================================
// APPROVALS
// ============================================================================

export type ApprovalEntityType = 'version' | 'budget' | 'scenario';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Approval {
  id: string;
  entity_type: ApprovalEntityType;
  entity_id: string;
  requester_id: string;
  approver_id: string;
  status: ApprovalStatus;
  notes?: string;
  approver_notes?: string;
  requested_at: string;
  actioned_at?: string;
}

export interface ApprovalWithUsers extends Approval {
  requester_name: string;
  approver_name: string;
  entity_name: string;
}

// ============================================================================
// SENSITIVITY ANALYSIS & WHAT-IF
// ============================================================================

export type AnalysisType = 'sensitivity' | 'goal_seek' | 'monte_carlo';

export interface SensitivityAnalysis {
  id: string;
  version_id: string;
  scenario_id?: string;
  name: string;
  analysis_type: AnalysisType;
  config: SensitivityConfig | GoalSeekConfig | MonteCarloConfig;
  results?: SensitivityResults | GoalSeekResults | MonteCarloResults;
  created_by?: string;
  created_at: string;
  completed_at?: string;
}

// Sensitivity Analysis Configuration
export interface SensitivityConfig {
  variable1: {
    driver_id: string;
    name: string;
    min: number;
    max: number;
    steps: number;
  };
  variable2?: {
    driver_id: string;
    name: string;
    min: number;
    max: number;
    steps: number;
  };
  output_metric: string; // MetricKey to analyze
}

export interface SensitivityResults {
  table: number[][]; // 2D array of results
  min_value: number;
  max_value: number;
  base_value: number;
}

// Goal Seek Configuration
export interface GoalSeekConfig {
  target_metric: string; // MetricKey to achieve
  target_value: number;
  variable_driver_id: string;
  variable_name: string;
  initial_guess?: number;
  max_iterations?: number;
  tolerance?: number;
}

export interface GoalSeekResults {
  solution: number;
  achieved_value: number;
  iterations: number;
  converged: boolean;
}

// Monte Carlo Configuration
export interface MonteCarloConfig {
  iterations: number;
  variables: Array<{
    driver_id: string;
    name: string;
    distribution: 'normal' | 'uniform' | 'triangular';
    params: {
      mean?: number;
      std_dev?: number;
      min?: number;
      max?: number;
      mode?: number;
    };
  }>;
  output_metrics: string[]; // Array of MetricKeys
}

export interface MonteCarloResults {
  summary: {
    [metricKey: string]: {
      mean: number;
      median: number;
      std_dev: number;
      min: number;
      max: number;
      percentile_5: number;
      percentile_95: number;
    };
  };
  histogram_data: {
    [metricKey: string]: {
      bins: number[];
      counts: number[];
    };
  };
}

// ============================================================================
// FORECAST TEMPLATES
// ============================================================================

export interface ForecastTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  config: TemplateConfig;
  preview_data?: Record<string, unknown>;
  created_by?: string;
  is_public: boolean;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateConfig {
  drivers: Array<{
    name: string;
    display_name: string;
    category: DriverCategory;
    default_value?: number;
    formula?: string;
  }>;
  assumptions: Record<string, unknown>;
  formulas: Record<string, string>;
}

// ============================================================================
// CHANGE LOG & AUDIT TRAIL
// ============================================================================

export type ChangeAction = 'create' | 'update' | 'delete' | 'clone' | 'approve' | 'reject';

export interface ChangeLog {
  id: string;
  entity_type: string;
  entity_id: string;
  user_id?: string;
  action: ChangeAction;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ChangeLogWithUser extends ChangeLog {
  user_name: string;
  user_email: string;
}

// ============================================================================
// FORECASTING
// ============================================================================

export interface TrendAnalysis {
  metric_key: string;
  historical_years: Year[];
  historical_values: number[];
  forecast_years: Year[];
  forecast_values: number[];
  trend_type: 'linear' | 'exponential' | 'polynomial';
  confidence_interval?: {
    lower: number[];
    upper: number[];
  };
  r_squared?: number;
}

export interface GrowthRate {
  metric_key: string;
  start_year: Year;
  end_year: Year;
  start_value: number;
  end_value: number;
  cagr: number; // Compound Annual Growth Rate
  simple_growth_rate: number;
}

export interface SeasonalPattern {
  metric_key: string;
  pattern: 'monthly' | 'quarterly' | 'custom';
  factors: number[]; // Seasonal adjustment factors
  base_year: Year;
}

// ============================================================================
// ANALYTICS & KPIs
// ============================================================================

export interface KPI {
  key: string;
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'flat';
  change_pct: number;
  comparison_period: string;
  category: 'revenue' | 'profitability' | 'efficiency' | 'liquidity' | 'growth';
}

export interface FinancialRatio {
  name: string;
  value: number;
  category: 'liquidity' | 'profitability' | 'efficiency' | 'leverage';
  benchmark?: number;
  interpretation: string;
}

export interface CashRunway {
  months: number;
  runway_date: string;
  current_cash: number;
  avg_monthly_burn: number;
  warning_level: 'safe' | 'caution' | 'critical';
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateScenarioRequest {
  version_id: string;
  name: string;
  type: ScenarioType;
  description?: string;
  parent_scenario_id?: string;
  copy_data_from?: string; // Scenario ID to copy data from
}

export interface CreateDriverRequest {
  model_id: string;
  name: string;
  display_name: string;
  category: DriverCategory;
  unit?: string;
  formula?: string;
  description?: string;
  default_value?: number;
  min_value?: number;
  max_value?: number;
}

export interface SetDriverValuesRequest {
  driver_id: string;
  scenario_id: string;
  values: Array<{
    year: Year;
    value: number;
    source?: DriverValueSource;
  }>;
}

export interface CreateBudgetRequest {
  model_id: string;
  name: string;
  fiscal_year: number;
  description?: string;
  lines: Array<{
    category: string;
    subcategory?: string;
    metric_key?: string;
    year: Year;
    budgeted_value: number;
  }>;
}

export interface RequestApprovalRequest {
  entity_type: ApprovalEntityType;
  entity_id: string;
  approver_id: string;
  notes?: string;
}

export interface RunSensitivityRequest {
  version_id: string;
  scenario_id?: string;
  name: string;
  config: SensitivityConfig;
}

// ============================================================================
// WIZARD STATE
// ============================================================================

export interface WizardState {
  step: number;
  total_steps: number;
  model_name?: string;
  description?: string;
  template_id?: string;
  time_horizon?: {
    start_year: Year;
    end_year: Year;
  };
  drivers?: Array<{
    name: string;
    category: DriverCategory;
    default_value?: number;
  }>;
  assumptions?: Record<string, unknown>;
}

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  component: string;
  validation?: (data: WizardState) => boolean;
}
