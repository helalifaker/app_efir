# School Relocation Planner

A comprehensive financial planning application for school relocation, supporting dual-curriculum modeling (French & IB), multiple rent models, and sophisticated tuition simulation.

## Features

- 📊 **Dual-Curriculum Support**: French and IB curricula with independent planning
- 🏢 **Three Rent Models**: FixedEscalation, RevenueShare, and PartnerModel
- 💰 **Tuition Simulator**: Rent-driven simulation to maintain target EBITDA
- 📈 **Financial Statements**: P&L, Balance Sheet, and Cash Flow with enhanced calculations
- 🔄 **Capex Auto-Reinvestment**: Class-based reinvestment rules (Building, FF&E, IT, Other)
- 📋 **Version Management**: Draft → Ready → Locked workflow with audit trails

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Database**: Supabase (PostgreSQL) with Row-Level Security
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript 5.x

## Quick Start

### Prerequisites

- Node.js 20+
- Supabase account

### Installation

```bash
npm install
```

### Database Setup

Run these SQL scripts in Supabase SQL Editor (in order):

1. `sql/school_relocation_planner_migration.sql` - Create tables
2. `sql/srp_rls_policies.sql` - Enable security policies
3. `sql/srp_seed.sql` - Add test data (optional)

### Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage Guide

### 1. Configure Curriculum Data

Navigate to your version and configure dual-curriculum data (French & IB):

- Set capacity and student enrollment per year
- Define base tuition for each curriculum
- Configure teacher/non-teacher ratios
- Set CPI frequency (1, 2, or 3 years)

### 2. Configure Rent Plans

Choose from three rent models for relocation years (2028+):

**FixedEscalation**
- Base rent with periodic escalations
- Configure escalation rate and frequency
- Formula: `rent(t) = baseRent × (1 + rate)^escalations`

**RevenueShare**
- Rent as percentage of revenue
- Optional minimum and maximum caps
- Formula: `rent = revenue × pct` (capped if applicable)

**PartnerModel**
- Capex-based with growing yield
- Land + BUA costs × yield percentage
- Formula: `rent = capexBase × yield(t)`

### 3. Configure Opex Plans

Set operating expenses as percentage of revenue:
- Single opex percentage, OR
- Sub-accounts (must sum to 100%)

### 4. Run Tuition Simulator

Navigate to `/tuition-simulator` to run rent-driven simulations:

1. Select a version
2. Choose rent model
3. Set tuition adjustment factors for FR and IB (-20% to +50%)
4. Optionally set target EBITDA
5. Click "Run Simulation"
6. Review year-by-year results with EBITDA margins and rent load percentages

### 5. Admin: Configure Capex Rules

Navigate to `/admin/capex` to configure auto-reinvestment rules:

- **Building**: Default 20-year cycle
- **FF&E**: Default 7-year cycle
- **IT**: Default 4-year cycle
- **Other**: Custom cycle

Set trigger types:
- **Cycle**: Time-based reinvestment
- **Utilization**: Usage-based (when utilization exceeds threshold)
- **Both**: Combined triggers

## API Routes

### Curriculum API
- `GET /api/versions/[id]/curriculum` - Fetch curriculum plans
- `POST /api/versions/[id]/curriculum` - Batch create/update
- `PUT /api/versions/[id]/curriculum` - Update single plan
- `DELETE /api/versions/[id]/curriculum?year=X&curriculum_type=FR` - Delete plan

### Rent API
- `GET /api/versions/[id]/rent` - Fetch rent plans
- `POST /api/versions/[id]/rent` - Create/update (batch or projection mode)
- `PUT /api/versions/[id]/rent` - Update single plan
- `DELETE /api/versions/[id]/rent?year=X` - Delete plan

### Tuition Simulator API
- `POST /api/tuition-simulator` - Run simulation with parameters

### Opex API
- `GET /api/versions/[id]/opex` - Fetch opex plans
- `POST /api/versions/[id]/opex` - Create/update opex structure
- `PUT /api/versions/[id]/opex` - Update specific plan
- `DELETE /api/versions/[id]/opex` - Delete opex plan

### Admin Capex Rules API
- `GET /api/admin/capex-rules` - Fetch all rules
- `POST /api/admin/capex-rules` - Create new rule
- `PUT /api/admin/capex-rules` - Update rule
- `DELETE /api/admin/capex-rules?id=X` - Delete rule

## Documentation

- **[Implementation Plan](./docs/SCHOOL_RELOCATION_PLANNER_IMPLEMENTATION.md)** - Detailed 7-week implementation plan
- **[PRD](./docs/PRD_v1.4.md)** - Product Requirements Document (coming soon)
- **[TSD](./docs/TSD_v1.0.md)** - Technical Specification Document (coming soon)

## Project Structure

```
├── app/                  # Next.js App Router pages & API routes
├── lib/                  # Utilities & core logic
│   └── engine/          # Calculation engines (rent, curriculum, financials)
├── sql/                  # Database migrations & seeds
├── docs/                 # Documentation
└── types/                # TypeScript type definitions
```

## License

Private - All rights reserved
