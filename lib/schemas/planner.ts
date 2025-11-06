// lib/schemas/planner.ts
// Zod validation schemas for EFIR Financial Planner

import { z } from 'zod';

// ============================================================================
// SCENARIOS
// ============================================================================

export const ScenarioTypeSchema = z.enum(['base', 'optimistic', 'pessimistic', 'custom']);

export const CreateScenarioSchema = z.object({
  version_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: ScenarioTypeSchema,
  description: z.string().max(1000).optional(),
  parent_scenario_id: z.string().uuid().optional(),
  copy_data_from: z.string().uuid().optional(),
}) as z.ZodType<{
  version_id: string;
  name: string;
  type: 'base' | 'optimistic' | 'pessimistic' | 'custom';
  description?: string;
  parent_scenario_id?: string;
  copy_data_from?: string;
}>;

export const UpdateScenarioSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  assumptions: z.record(z.string(), z.unknown()).optional(),
}) as z.ZodType<{
  name?: string;
  description?: string;
  assumptions?: Record<string, unknown>;
}>;

export const ScenarioResponseSchema = z.object({
  id: z.string().uuid(),
  version_id: z.string().uuid(),
  name: z.string(),
  type: ScenarioTypeSchema,
  description: z.string().optional(),
  parent_scenario_id: z.string().uuid().optional(),
  assumptions: z.record(z.string(), z.unknown()),
  created_by: z.string().uuid().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

// ============================================================================
// DRIVERS
// ============================================================================

export const DriverCategorySchema = z.enum(['revenue', 'cost', 'growth', 'operational', 'financial', 'custom']);

export const CreateDriverSchema = z.object({
  model_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  display_name: z.string().min(1).max(255),
  category: DriverCategorySchema,
  unit: z.string().max(50).optional(),
  formula: z.string().max(500).optional(),
  description: z.string().max(1000).optional(),
  is_global: z.boolean().optional(),
  default_value: z.number().optional(),
  min_value: z.number().optional(),
  max_value: z.number().optional(),
}).transform((data) => ({ ...data, is_global: data.is_global ?? false }));

export const UpdateDriverSchema = z.object({
  display_name: z.string().min(1).max(255).optional(),
  unit: z.string().max(50).optional(),
  formula: z.string().max(500).optional(),
  description: z.string().max(1000).optional(),
  default_value: z.number().optional(),
  min_value: z.number().optional(),
  max_value: z.number().optional(),
});

export const DriverValueSchema = z.object({
  year: z.number().int().min(2023).max(2052),
  value: z.number(),
  source: z.enum(['manual', 'calculated', 'imported', 'forecasted']).optional(),
  notes: z.string().max(500).optional(),
});

export const SetDriverValuesSchema = z.object({
  driver_id: z.string().uuid(),
  scenario_id: z.string().uuid(),
  values: z.array(DriverValueSchema).min(1),
});

// ============================================================================
// BUDGETS
// ============================================================================

export const BudgetStatusSchema = z.enum(['draft', 'submitted', 'approved', 'rejected', 'archived']);

export const BudgetLineSchema = z.object({
  category: z.string().min(1).max(100),
  subcategory: z.string().max(100).optional(),
  metric_key: z.string().max(100).optional(),
  year: z.number().int().min(2023).max(2052),
  budgeted_value: z.number(),
  notes: z.string().max(500).optional(),
});

export const CreateBudgetSchema = z.object({
  model_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  fiscal_year: z.number().int().min(2023).max(2052),
  description: z.string().max(1000).optional(),
  lines: z.array(BudgetLineSchema).min(1),
});

export const UpdateBudgetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  status: BudgetStatusSchema.optional(),
});

export const UpdateBudgetLineSchema = z.object({
  budgeted_value: z.number().optional(),
  actual_value: z.number().optional(),
  notes: z.string().max(500).optional(),
});

export const ApproveBudgetSchema = z.object({
  notes: z.string().max(1000).optional(),
});

export const RejectBudgetSchema = z.object({
  rejection_reason: z.string().min(1).max(1000),
});

// ============================================================================
// COMMENTS
// ============================================================================

export const CommentEntityTypeSchema = z.enum(['version', 'scenario', 'driver', 'budget', 'assumption']);

export const CreateCommentSchema = z.object({
  entity_type: CommentEntityTypeSchema,
  entity_id: z.string().uuid(),
  parent_comment_id: z.string().uuid().optional(),
  content: z.string().min(1).max(5000),
  mentions: z.array(z.string().uuid()).optional(),
}).transform((data) => ({ ...data, mentions: data.mentions ?? [] }));

export const UpdateCommentSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  resolved: z.boolean().optional(),
});

// ============================================================================
// APPROVALS
// ============================================================================

export const ApprovalEntityTypeSchema = z.enum(['version', 'budget', 'scenario']);
export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'cancelled']);

export const RequestApprovalSchema = z.object({
  entity_type: ApprovalEntityTypeSchema,
  entity_id: z.string().uuid(),
  approver_id: z.string().uuid(),
  notes: z.string().max(1000).optional(),
});

export const ApproveRejectSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  approver_notes: z.string().max(1000).optional(),
});

// ============================================================================
// SENSITIVITY ANALYSIS
// ============================================================================

export const AnalysisTypeSchema = z.enum(['sensitivity', 'goal_seek', 'monte_carlo']);

export const SensitivityVariableSchema = z.object({
  driver_id: z.string().uuid(),
  name: z.string(),
  min: z.number(),
  max: z.number(),
  steps: z.number().int().min(2).max(20),
});

export const SensitivityConfigSchema = z.object({
  variable1: SensitivityVariableSchema,
  variable2: SensitivityVariableSchema.optional(),
  output_metric: z.string(),
});

export const GoalSeekConfigSchema = z.object({
  target_metric: z.string(),
  target_value: z.number(),
  variable_driver_id: z.string().uuid(),
  variable_name: z.string(),
  initial_guess: z.number().optional(),
  max_iterations: z.number().int().min(10).max(1000).optional(),
  tolerance: z.number().positive().optional(),
}).transform((data) => ({
  ...data,
  max_iterations: data.max_iterations ?? 100,
  tolerance: data.tolerance ?? 0.01,
}));

export const MonteCarloVariableSchema = z.object({
  driver_id: z.string().uuid(),
  name: z.string(),
  distribution: z.enum(['normal', 'uniform', 'triangular']),
  params: z.object({
    mean: z.number().optional(),
    std_dev: z.number().positive().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    mode: z.number().optional(),
  }),
});

export const MonteCarloConfigSchema = z.object({
  iterations: z.number().int().min(100).max(10000).optional(),
  variables: z.array(MonteCarloVariableSchema).min(1),
  output_metrics: z.array(z.string()).min(1),
}).transform((data) => ({ ...data, iterations: data.iterations ?? 1000 }));

export const RunSensitivitySchema = z.object({
  version_id: z.string().uuid(),
  scenario_id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  analysis_type: AnalysisTypeSchema,
  config: z.union([
    SensitivityConfigSchema,
    GoalSeekConfigSchema,
    MonteCarloConfigSchema,
  ]),
});

// ============================================================================
// FORECAST TEMPLATES
// ============================================================================

export const TemplateDriverSchema = z.object({
  name: z.string().min(1).max(100),
  display_name: z.string().min(1).max(255),
  category: DriverCategorySchema,
  default_value: z.number().optional(),
  formula: z.string().max(500).optional(),
});

export const TemplateConfigSchema = z.object({
  drivers: z.array(TemplateDriverSchema),
  assumptions: z.record(z.string(), z.unknown()).optional(),
  formulas: z.record(z.string(), z.string()).optional(),
}).transform((data) => ({
  ...data,
  assumptions: data.assumptions ?? {},
  formulas: data.formulas ?? {},
}));

export const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  config: TemplateConfigSchema,
  preview_data: z.record(z.string(), z.unknown()).optional(),
  is_public: z.boolean().optional(),
}).transform((data) => ({ ...data, is_public: data.is_public ?? false }));

export const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  config: TemplateConfigSchema.optional(),
  is_public: z.boolean().optional(),
});

// ============================================================================
// FORECASTING
// ============================================================================

export const TrendAnalysisRequestSchema = z.object({
  version_id: z.string().uuid(),
  scenario_id: z.string().uuid().optional(),
  metric_key: z.string(),
  historical_years: z.array(z.number().int()).min(2),
  forecast_years: z.array(z.number().int()).min(1),
  trend_type: z.enum(['linear', 'exponential', 'polynomial']).optional(),
}).transform((data) => ({ ...data, trend_type: data.trend_type ?? 'linear' }));

export const GrowthExtrapolationSchema = z.object({
  version_id: z.string().uuid(),
  scenario_id: z.string().uuid().optional(),
  metric_key: z.string(),
  base_year: z.number().int(),
  base_value: z.number(),
  growth_rate: z.number(), // As decimal (e.g., 0.15 for 15%)
  forecast_years: z.array(z.number().int()).min(1),
  compounding: z.boolean().optional(),
}).transform((data) => ({ ...data, compounding: data.compounding ?? true }));

export const SeasonalAdjustmentSchema = z.object({
  version_id: z.string().uuid(),
  scenario_id: z.string().uuid().optional(),
  metric_key: z.string(),
  pattern: z.enum(['monthly', 'quarterly', 'custom']),
  factors: z.array(z.number()).optional(),
  base_year: z.number().int(),
});

// ============================================================================
// WIZARD
// ============================================================================

export const WizardStepSchema = z.object({
  step: z.number().int().min(1).max(10),
  data: z.record(z.string(), z.unknown()),
});

export const WizardCompleteSchema = z.object({
  model_name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  template_id: z.string().uuid().optional(),
  time_horizon: z.object({
    start_year: z.number().int().min(2023),
    end_year: z.number().int().max(2052),
  }),
  drivers: z.array(CreateDriverSchema).optional(),
  assumptions: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================================
// ANALYTICS
// ============================================================================

export const KPIRequestSchema = z.object({
  version_id: z.string().uuid(),
  scenario_id: z.string().uuid().optional(),
  year: z.number().int().min(2023).max(2052).optional(),
  metrics: z.array(z.string()).optional(), // If not provided, return all KPIs
});

export const RatioAnalysisRequestSchema = z.object({
  version_id: z.string().uuid(),
  scenario_id: z.string().uuid().optional(),
  year: z.number().int().min(2023).max(2052),
  ratios: z.array(z.string()).optional(), // If not provided, return all ratios
});

export const CashRunwayRequestSchema = z.object({
  version_id: z.string().uuid(),
  scenario_id: z.string().uuid().optional(),
  start_year: z.number().int().min(2023).max(2052),
});

// ============================================================================
// COMPARE SCENARIOS
// ============================================================================

export const CompareScenariosSchema = z.object({
  version_id: z.string().uuid(),
  scenario_ids: z.array(z.string().uuid()).min(2).max(5),
  metrics: z.array(z.string()).optional(),
  years: z.array(z.number().int().min(2023).max(2052)).optional(),
});

// ============================================================================
// EXPORT SCHEMAS (for external use)
// ============================================================================

export const schemas = {
  // Scenarios
  CreateScenarioSchema,
  UpdateScenarioSchema,
  ScenarioResponseSchema,

  // Drivers
  CreateDriverSchema,
  UpdateDriverSchema,
  SetDriverValuesSchema,

  // Budgets
  CreateBudgetSchema,
  UpdateBudgetSchema,
  ApproveBudgetSchema,
  RejectBudgetSchema,

  // Comments
  CreateCommentSchema,
  UpdateCommentSchema,

  // Approvals
  RequestApprovalSchema,
  ApproveRejectSchema,

  // Sensitivity
  RunSensitivitySchema,

  // Templates
  CreateTemplateSchema,
  UpdateTemplateSchema,

  // Forecasting
  TrendAnalysisRequestSchema,
  GrowthExtrapolationSchema,
  SeasonalAdjustmentSchema,

  // Wizard
  WizardCompleteSchema,

  // Analytics
  KPIRequestSchema,
  RatioAnalysisRequestSchema,
  CashRunwayRequestSchema,

  // Compare
  CompareScenariosSchema,
};
