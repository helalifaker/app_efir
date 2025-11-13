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
