# EFIR - Financial Model Management App

A Next.js application for managing financial model versions with comparison, validation, and reporting features.

## Features

- 📊 Financial model versioning (draft → ready → locked)
- 📈 Compare multiple versions side-by-side
- ✅ Built-in validation with configurable rules
- 📋 Printable financial reports
- 🔐 Row-level security (RLS) for data protection
- ⚙️ Admin panel for app settings
- 🔄 Status history and audit trail

## Quick Start

See [docs/setup.md](./docs/setup.md) for detailed setup instructions.

### Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

### Database Setup

Run these SQL scripts in Supabase (in order):

1. `sql/schema.sql` - Create tables
2. `sql/rls_policies.sql` - Enable security
3. `sql/seed.sql` - Add test data (optional)

## Documentation

- **[Setup Guide](./docs/setup.md)** - First-time setup
- **[Deployment Guide](./docs/deploy.md)** - Deploy to Vercel
- **[Security Docs](./docs/security.md)** - RLS and authentication

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS
- **Validation**: Zod
- **Deployment**: Vercel

## License

Private - All rights reserved
