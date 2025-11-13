# School Relocation Planner - Implementation Plan

## Overview

This document outlines the plan to extend the existing EFIR financial model app to support the School Relocation Planner requirements as specified in PRD v1.4 and TSD v1.0.

## Current State Analysis

### ✅ What We Have (EFIR Foundation)

1. **Year Range & Time Series**
   - 2023-2052 year range ✓
   - Historical years 2023-2024 (read-only) ✓
   - Time-series data model with SeriesPoint ✓

2. **Version Management**
   - Version status workflow (Draft → Ready → Locked → Archived) ✓
   - Status history tracking ✓
   - Validation system ✓

3. **Financial Statements**
   - P&L, Balance Sheet, Cash Flow ✓
   - Metrics calculation engine ✓
   - Statement lines structure ✓

4. **Admin System**
   - Admin configuration (app_settings table) ✓
   - VAT, CPI, depreciation, validation rules ✓

5. **Technical Foundation**
   - Next.js 16 + React 19 ✓
   - Tailwind CSS v4 ✓
   - Supabase (PostgreSQL + Auth) ✓
   - RLS security ✓

### ❌ What's Missing (School Relocation Planner Specific)

1. **Dual-Curriculum Model**
   - curriculum_plan table
   - French & IB curriculum tracking
   - Student capacity, tuition, teacher/non-teacher ratios
   - CPI frequency for tuition (1-3 years)

2. **Rent Models**
   - rent_plan table
   - Three rent models:
     - FixedEscalation (base + annual escalation)
     - RevenueShare (% of revenue with min/max)
     - PartnerModel (land/BUA + yield growth)
   - Transition years logic (2025-2027 clone 2024A rent)

3. **Tuition Simulator**
   - Rent-driven tuition simulation
   - Target EBITDA maintenance
   - Per-curriculum tuition adjustment
   - Rent Load % tracking
   - Scenario creation from simulation

4. **Capex Auto-Reinvestment**
   - capex_rule table (Admin-managed)
   - Class-based rules (Building, FF&E, IT, Other)
   - Cycle-based reinvestment (20y, 7y, 4y, etc.)
   - Inflation-adjusted costs

5. **Opex Structure**
   - opex_plan table
   - Opex as % of revenue
   - Optional sub-accounts

6. **Financial Statement Enhancements**
   - DSO (Days Sales Outstanding) → Accounts Receivable
   - DPO (Days Payable Outstanding) → Accounts Payable
   - Deferred Revenue % configuration
   - COGS calculation (Staff + Rent + Opex)

7. **UI Components**
   - Rent Lens (inline in Costs Analysis tab)
   - Tuition Simulator page (/tuition-simulator)
   - Curriculum split view (French/IB tabs)
   - Compare page enhancements
   - Admin Capex Configuration UI

8. **Version Cloning**
   - Clone version with all data
   - Scenario creation workflow

---

## Implementation Plan

### Phase 1: Database Schema Extensions (Week 1)

**Goal:** Add new tables and update existing schema to support School Relocation Planner features.

#### 1.1 Create New Tables

```sql
-- curriculum_plan table
CREATE TABLE public.curriculum_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  curriculum_type TEXT NOT NULL CHECK (curriculum_type IN ('FR', 'IB')),
  year INTEGER NOT NULL CHECK (year >= 2023 AND year <= 2052),
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  students INTEGER NOT NULL CHECK (students >= 0 AND students <= capacity),
  tuition DECIMAL(12, 2) NOT NULL CHECK (tuition > 0),
  teacher_ratio DECIMAL(5, 4) NOT NULL CHECK (teacher_ratio > 0 AND teacher_ratio < 1),
  non_teacher_ratio DECIMAL(5, 4) NOT NULL CHECK (non_teacher_ratio > 0 AND non_teacher_ratio < 1),
  cpi_frequency INTEGER NOT NULL CHECK (cpi_frequency IN (1, 2, 3)),
  cpi_base_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_curriculum_year UNIQUE (version_id, curriculum_type, year)
);

-- rent_plan table
CREATE TABLE public.rent_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year >= 2023 AND year <= 2052),
  model_type TEXT CHECK (model_type IN ('FixedEscalation', 'RevenueShare', 'PartnerModel')),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  model_config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_rent_year UNIQUE (version_id, year)
);

-- capex_rule table
CREATE TABLE public.capex_rule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class TEXT NOT NULL CHECK (class IN ('Building', 'FF&E', 'IT', 'Other')),
  cycle_years INTEGER NOT NULL CHECK (cycle_years > 0),
  inflation_index TEXT NOT NULL,
  base_cost DECIMAL(12, 2) NOT NULL CHECK (base_cost > 0),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('cycle', 'utilization', 'both')) DEFAULT 'cycle',
  utilization_threshold DECIMAL(5, 2) CHECK (utilization_threshold >= 0 AND utilization_threshold <= 100),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- opex_plan table
CREATE TABLE public.opex_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  sub_account TEXT,
  pct_of_revenue DECIMAL(5, 2) NOT NULL CHECK (pct_of_revenue >= 0 AND pct_of_revenue <= 100),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- tuition_simulation table
CREATE TABLE public.tuition_simulation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  rent_model_type TEXT NOT NULL CHECK (rent_model_type IN ('FixedEscalation', 'RevenueShare', 'PartnerModel')),
  adjustment_factor_fr DECIMAL(5, 2) NOT NULL CHECK (adjustment_factor_fr >= -20 AND adjustment_factor_fr <= 50),
  adjustment_factor_ib DECIMAL(5, 2) NOT NULL CHECK (adjustment_factor_ib >= -20 AND adjustment_factor_ib <= 50),
  target_margin DECIMAL(5, 2),
  target_ebitda DECIMAL(12, 2),
  results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 1.2 Update app_settings

Add new financial parameters:

```sql
INSERT INTO public.app_settings (key, value) VALUES
  ('financial_statement', '{
    "dso_days": 30,
    "dpo_days": 45,
    "deferred_revenue_pct": 0.35
  }'::jsonb),
  ('teacher_salary', '{
    "fr_base": 120000,
    "ib_base": 150000,
    "cpi_adjustment": true
  }'::jsonb),
  ('non_teacher_salary', '{
    "fr_base": 80000,
    "ib_base": 90000,
    "cpi_adjustment": true
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;
```

#### 1.3 Create RLS Policies

Apply appropriate RLS policies for new tables (follow existing patterns).

#### 1.4 Create Indexes

```sql
CREATE INDEX idx_curriculum_plan_version ON public.curriculum_plan(version_id);
CREATE INDEX idx_curriculum_plan_type_year ON public.curriculum_plan(curriculum_type, year);
CREATE INDEX idx_rent_plan_version ON public.rent_plan(version_id);
CREATE INDEX idx_rent_plan_year ON public.rent_plan(year);
CREATE INDEX idx_capex_rule_class ON public.capex_rule(class);
CREATE INDEX idx_opex_plan_version ON public.opex_plan(version_id);
CREATE INDEX idx_tuition_sim_version ON public.tuition_simulation(version_id);
```

#### Deliverables
- [ ] Migration script: `sql/school_relocation_planner_migration.sql`
- [ ] RLS policies script: `sql/srp_rls_policies.sql`
- [ ] Seed data for testing: `sql/srp_seed.sql`

---

### Phase 2: Calculation Engine & Core Logic (Week 2)

**Goal:** Implement calculation engines for rent models, curriculum aggregation, and financial formulas.

#### 2.1 Rent Calculation Engine

```typescript
// lib/engine/rentCalculator.ts
export interface RentModel {
  type: 'FixedEscalation' | 'RevenueShare' | 'PartnerModel'
  config: RentModelConfig
}

export type RentModelConfig =
  | FixedEscalationConfig
  | RevenueShareConfig
  | PartnerModelConfig

export interface FixedEscalationConfig {
  baseRent: number
  escalationRate: number
  escalationFrequency: number // 1, 2, or 3 years
}

export interface RevenueShareConfig {
  revenueSharePct: number
  minimumRent?: number
  maximumRent?: number
}

export interface PartnerModelConfig {
  landSize: number // sqm
  landPricePerSqm: number
  buaSize: number // sqm
  buaPricePerSqm: number
  yieldBase: number
  yieldGrowthRate: number
  growthFrequency: number // 1, 2, or 3 years
}

export function calculateRent(
  model: RentModel,
  year: number,
  baseYear: number,
  revenue?: number
): number {
  switch (model.type) {
    case 'FixedEscalation':
      return calculateFixedEscalation(model.config as FixedEscalationConfig, year, baseYear)
    case 'RevenueShare':
      return calculateRevenueShare(model.config as RevenueShareConfig, revenue!)
    case 'PartnerModel':
      return calculatePartnerModel(model.config as PartnerModelConfig, year, baseYear)
  }
}

function calculateFixedEscalation(
  config: FixedEscalationConfig,
  year: number,
  baseYear: number
): number {
  const yearsSinceBase = year - baseYear
  const numberOfEscalations = Math.floor(yearsSinceBase / config.escalationFrequency)
  return config.baseRent * Math.pow(1 + config.escalationRate, numberOfEscalations)
}

function calculateRevenueShare(
  config: RevenueShareConfig,
  revenue: number
): number {
  let rent = revenue * (config.revenueSharePct / 100)
  if (config.minimumRent) rent = Math.max(rent, config.minimumRent)
  if (config.maximumRent) rent = Math.min(rent, config.maximumRent)
  return rent
}

function calculatePartnerModel(
  config: PartnerModelConfig,
  year: number,
  baseYear: number
): number {
  const capexBase =
    (config.landSize * config.landPricePerSqm) +
    (config.buaSize * config.buaPricePerSqm)

  const yearsSinceBase = year - baseYear
  const numberOfGrowths = Math.floor(yearsSinceBase / config.growthFrequency)
  const currentYield = config.yieldBase * Math.pow(1 + config.yieldGrowthRate, numberOfGrowths)

  return capexBase * (currentYield / 100)
}

// NPV calculation
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
```

#### 2.2 Curriculum Aggregation Engine

```typescript
// lib/engine/curriculumCalculator.ts
export interface CurriculumData {
  curriculumType: 'FR' | 'IB'
  year: number
  capacity: number
  students: number
  tuition: number
  teacherRatio: number
  nonTeacherRatio: number
  cpiFrequency: number
  cpiBaseYear: number
}

export interface StaffCosts {
  teacherCosts: number
  nonTeacherCosts: number
  totalStaffCosts: number
}

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

export function calculateStaffCosts(
  curriculumData: CurriculumData,
  teacherSalaryBase: number,
  nonTeacherSalaryBase: number,
  cpiRate: number,
  salaryBaseYear: number
): StaffCosts {
  const yearsSinceBase = curriculumData.year - salaryBaseYear
  const teacherSalary = teacherSalaryBase * Math.pow(1 + cpiRate, yearsSinceBase)
  const nonTeacherSalary = nonTeacherSalaryBase * Math.pow(1 + cpiRate, yearsSinceBase)

  const teacherCosts = curriculumData.students * curriculumData.teacherRatio * teacherSalary
  const nonTeacherCosts = curriculumData.students * curriculumData.nonTeacherRatio * nonTeacherSalary

  return {
    teacherCosts,
    nonTeacherCosts,
    totalStaffCosts: teacherCosts + nonTeacherCosts
  }
}

function applyTuitionCPI(
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

export function aggregateCurricula(
  frData: CurriculumData,
  ibData: CurriculumData,
  adminConfig: AdminConfig
): AggregateFinancials {
  const frRevenue = calculateRevenue(frData, adminConfig.cpi.rates[frData.year])
  const ibRevenue = calculateRevenue(ibData, adminConfig.cpi.rates[ibData.year])

  const frStaff = calculateStaffCosts(
    frData,
    adminConfig.teacherSalary.fr_base,
    adminConfig.nonTeacherSalary.fr_base,
    adminConfig.cpi.rates[frData.year],
    adminConfig.cpi.baseYear
  )

  const ibStaff = calculateStaffCosts(
    ibData,
    adminConfig.teacherSalary.ib_base,
    adminConfig.nonTeacherSalary.ib_base,
    adminConfig.cpi.rates[ibData.year],
    adminConfig.cpi.baseYear
  )

  return {
    totalRevenue: frRevenue + ibRevenue,
    totalStudents: frData.students + ibData.students,
    totalCapacity: frData.capacity + ibData.capacity,
    totalStaffCosts: frStaff.totalStaffCosts + ibStaff.totalStaffCosts,
    revenueByClass: { FR: frRevenue, IB: ibRevenue },
    staffCostsByClass: {
      FR: frStaff.totalStaffCosts,
      IB: ibStaff.totalStaffCosts
    }
  }
}
```

#### 2.3 Financial Statement Calculations

```typescript
// lib/engine/financialStatements.ts

export function calculateCOGS(
  staffCosts: number,
  rent: number,
  otherOpex: number
): number {
  return staffCosts + rent + otherOpex
}

export function calculateAccountsReceivable(
  revenue: number,
  dsoDays: number
): number {
  return (revenue * dsoDays) / 365
}

export function calculateAccountsPayable(
  cogs: number,
  dpoDays: number
): number {
  return (cogs * dpoDays) / 365
}

export function calculateDeferredRevenue(
  revenue: number,
  deferredPct: number
): number {
  return revenue * deferredPct
}
```

#### Deliverables
- [ ] `lib/engine/rentCalculator.ts` - Rent calculation engine
- [ ] `lib/engine/curriculumCalculator.ts` - Curriculum aggregation
- [ ] `lib/engine/financialStatements.ts` - Enhanced financial calculations
- [ ] Unit tests for all calculation functions

---

### Phase 3: API Routes & Server Actions (Week 3)

**Goal:** Create API endpoints and server actions for new features.

#### 3.1 Curriculum Plan API

```typescript
// app/api/versions/[id]/curriculum/route.ts
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  // Fetch curriculum_plan for version
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // Create/update curriculum_plan
}
```

#### 3.2 Rent Plan API

```typescript
// app/api/versions/[id]/rent/route.ts
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  // Fetch rent_plan for version
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // Create/update rent_plan with model calculation
}
```

#### 3.3 Tuition Simulation API

```typescript
// app/api/tuition-simulator/route.ts
export async function POST(request: NextRequest) {
  // Run tuition simulation
  // Returns year-by-year impact, rent load %, required tuition increase
}
```

#### 3.4 Version Cloning API

```typescript
// app/api/versions/[id]/clone/route.ts
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // Clone version with all data (curriculum, rent, opex, capex)
  // Exclude: audit logs, approval history, tuition simulations
}
```

#### Deliverables
- [ ] Curriculum CRUD API
- [ ] Rent Plan CRUD API
- [ ] Tuition Simulation API
- [ ] Version Cloning API
- [ ] Opex Plan API
- [ ] Capex Rule API (Admin)

---

### Phase 4: UI Components (Week 4-5)

**Goal:** Build new UI components for School Relocation Planner features.

#### 4.1 Curriculum Split View Component

```typescript
// components/curriculum/CurriculumSplitView.tsx
'use client'

export function CurriculumSplitView({ versionId }: { versionId: string }) {
  const [activeTab, setActiveTab] = useState<'FR' | 'IB'>('FR')

  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="FR">🇫🇷 French</TabsTrigger>
          <TabsTrigger value="IB">🌍 IB</TabsTrigger>
        </TabsList>

        <TabsContent value="FR">
          <CurriculumTable versionId={versionId} curriculum="FR" />
        </TabsContent>

        <TabsContent value="IB">
          <CurriculumTable versionId={versionId} curriculum="IB" />
        </TabsContent>
      </Tabs>

      <AggregatedSummary versionId={versionId} />
    </div>
  )
}
```

#### 4.2 Rent Lens Component

```typescript
// components/rent/RentLens.tsx
'use client'

export function RentLens({ versionId }: { versionId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [selectedModel, setSelectedModel] = useState<RentModel>()

  return (
    <Card>
      <CardHeader onClick={() => setExpanded(!expanded)}>
        <CardTitle>Rent Model Configuration</CardTitle>
        <CardDescription>
          {selectedModel?.type || 'No model selected'} | NPV: {formatCurrency(npv)}
        </CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent>
          <RentModelSelector value={selectedModel} onChange={setSelectedModel} />
          <RentParameterForm model={selectedModel} />
          <SensitivityChart model={selectedModel} />
        </CardContent>
      )}
    </Card>
  )
}
```

#### 4.3 Tuition Simulator Page

```typescript
// app/tuition-simulator/page.tsx
export default function TuitionSimulatorPage() {
  return (
    <div className="grid grid-cols-3 gap-6">
      <RentConfigPanel /> {/* Left: Rent model selection & parameters */}
      <ImpactCharts />     {/* Center: Interactive charts */}
      <TuitionControls />  {/* Right: Tuition adjustment sliders */}
    </div>
  )
}
```

#### 4.4 Admin Capex Configuration

```typescript
// app/admin/capex/page.tsx
export default function AdminCapexPage() {
  return (
    <div>
      <CapexRuleList />
      <CapexRuleForm />
      <CapexTimelineVisualization />
    </div>
  )
}
```

#### Deliverables
- [ ] CurriculumSplitView component
- [ ] CurriculumTable component
- [ ] RentLens component
- [ ] RentModelSelector component
- [ ] TuitionSimulator page
- [ ] RentConfigPanel component
- [ ] TuitionControls component
- [ ] ImpactCharts component
- [ ] AdminCapexConfiguration page

---

### Phase 5: Integration & Testing (Week 6)

**Goal:** Integrate all components, test end-to-end workflows, and fix bugs.

#### 5.1 Integration Points

- [ ] Connect curriculum data to P&L (Revenue, Staff Costs)
- [ ] Connect rent plan to P&L and Cash Flow
- [ ] Connect opex plan to P&L
- [ ] Update Balance Sheet calculations (AR, AP, Deferred Revenue)
- [ ] Update Cash Flow with new calculations

#### 5.2 Testing

- [ ] Unit tests for calculation engines
- [ ] Integration tests for API routes
- [ ] E2E tests for key workflows:
  - Create version with dual-curriculum
  - Configure rent model
  - Run tuition simulation
  - Clone version
  - Generate reports

#### 5.3 Performance Optimization

- [ ] Ensure <50ms calculation response time
- [ ] Optimize large table rendering (virtualization)
- [ ] Memoize expensive calculations

#### Deliverables
- [ ] All components integrated
- [ ] Test suite passing
- [ ] Performance benchmarks met

---

### Phase 6: Documentation & Deployment (Week 7)

**Goal:** Complete documentation and deploy to production.

#### 6.1 Documentation

- [ ] Update README.md with School Relocation Planner overview
- [ ] Create PRD_v1.4.md and TSD_v1.0.md in /docs
- [ ] Update setup.md with new database migration steps
- [ ] Create user guide for Tuition Simulator
- [ ] Create admin guide for Capex Configuration

#### 6.2 Deployment

- [ ] Run database migrations in production
- [ ] Deploy to Vercel
- [ ] Verify all features work in production
- [ ] Create backup/rollback plan

#### Deliverables
- [ ] Complete documentation
- [ ] Production deployment
- [ ] User training materials

---

## Success Criteria

### Functional Requirements

- [ ] Dual-curriculum model (FR, IB) fully implemented
- [ ] Three rent models available and working
- [ ] Tuition Simulator operational with <50ms response time
- [ ] Capex auto-reinvestment with admin configuration
- [ ] Opex as % of revenue with sub-accounts
- [ ] Financial statements updated with new calculations
- [ ] Version cloning functional
- [ ] Compare page supports new features
- [ ] Admin panel includes new configuration options

### Non-Functional Requirements

- [ ] All calculations complete in <50ms
- [ ] UI responsive and accessible (WCAG 2.1 AA)
- [ ] RLS policies protect all new tables
- [ ] Database migrations reversible
- [ ] Test coverage >80%

### User Acceptance

- [ ] Admin can configure capex rules
- [ ] Admin can set financial parameters (DSO, DPO, etc.)
- [ ] Planner can create versions with dual-curriculum
- [ ] Planner can select and configure rent models
- [ ] Planner can run tuition simulations
- [ ] Planner can clone versions
- [ ] Planner can compare versions side-by-side
- [ ] Planner can export reports with new data

---

## Risk Mitigation

### Technical Risks

1. **Performance Degradation**
   - Risk: New calculations slow down app
   - Mitigation: Memoization, delta updates, edge caching

2. **Data Migration Issues**
   - Risk: Existing data incompatible with new schema
   - Mitigation: Thorough testing, rollback plan, staged deployment

3. **Calculation Errors**
   - Risk: Financial calculations incorrect
   - Mitigation: Comprehensive unit tests, manual verification

### Business Risks

1. **User Adoption**
   - Risk: Users don't understand new features
   - Mitigation: User training, documentation, tooltips

2. **Scope Creep**
   - Risk: Additional features requested mid-implementation
   - Mitigation: Strict adherence to PRD, change request process

---

## Next Steps

1. Review and approve this implementation plan
2. Set up environment variables for development
3. Create feature branch: `feature/school-relocation-planner`
4. Begin Phase 1: Database Schema Extensions

---

**Document Status:** Draft v1.0
**Last Updated:** 2025-11-13
**Next Review:** After Phase 1 completion
