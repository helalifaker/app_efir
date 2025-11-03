# EFIR Setup Guide

Complete setup instructions for a new EFIR deployment.

## Prerequisites

- Supabase account and project
- Vercel account (for deployment)
- Node.js 20+ installed locally

## Step 1: Supabase Setup

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for database to be ready
4. Note your project URL and API keys

### 1.2 Run Database Schema

Open **SQL Editor** in Supabase Dashboard and run scripts in order:

```bash
# 1. Create tables
sql/schema.sql

# 2. Enable RLS and add policies
sql/rls_policies.sql

# 3. Seed test data (optional)
sql/seed.sql
```

**Verify**:
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('models', 'model_versions', 'version_tabs');

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public';
```

All tables should have `rowsecurity = true` (except `app_settings`).

### 1.3 Get API Keys

1. Go to **Settings → API**
2. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **Keep secret!**

## Step 2: Local Development

### 2.1 Clone Repository

```bash
git clone <your-repo-url>
cd app_efir
```

### 2.2 Install Dependencies

```bash
npm install
```

### 2.3 Configure Environment

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

### 2.4 Run Development Server

```bash
npm run dev
```

Open http://localhost:3000

**Verify**:
- `/dashboard` loads
- `/versions` shows test data
- `/api/supabase-test` returns `{"ok": true}`

## Step 3: Vercel Deployment

See [deploy.md](./deploy.md) for detailed deployment instructions.

Quick summary:

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy!

## Verification Checklist

### Database

- [ ] All tables created
- [ ] RLS enabled on data tables
- [ ] Seed data exists
- [ ] App settings have defaults

### Local

- [ ] `npm run build` succeeds
- [ ] `npm run dev` runs without errors
- [ ] Can view test versions
- [ ] Can create/update versions
- [ ] Compare page works

### Production (Vercel)

- [ ] Build succeeds
- [ ] Environment variables set
- [ ] `/api/supabase-test` returns OK
- [ ] Can login/logout
- [ ] Data persists across sessions

## Troubleshooting

### "RLS policy violation"

**Cause**: Client code using `anon` key hitting RLS restrictions

**Fix**: Ensure user is authenticated, or test with NULL-owned models

### "Cannot read property of undefined"

**Cause**: Missing seed data or incorrect table structure

**Fix**: Re-run `sql/seed.sql`

### Build fails with "Module not found"

**Cause**: Missing dependencies

**Fix**: Delete `node_modules` and `package-lock.json`, run `npm install`

### "Service role key not found"

**Cause**: Environment variable not set in Vercel

**Fix**: Go to Vercel project settings → Environment Variables → Add `SUPABASE_SERVICE_ROLE_KEY`

## Next Steps

- [Security Guide](./security.md) - Understanding RLS and keys
- [Deploy Guide](./deploy.md) - Production deployment
- [API Documentation](./api.md) - Endpoint reference (coming soon)

## Common Operations

### Create a New Model

```sql
INSERT INTO models (name, owner_id) 
VALUES ('My Model', 'YOUR_USER_ID');
```

### Create a New Version

```sql
INSERT INTO model_versions (model_id, name, status, created_by)
VALUES ('MODEL_ID', 'V1', 'draft', 'YOUR_USER_ID');
```

### Add Tab Data

```sql
INSERT INTO version_tabs (version_id, tab, data)
VALUES ('VERSION_ID', 'pnl', '{"revenue": 100000}'::jsonb);
```

### Run Validation

```bash
curl http://localhost:3000/api/versions/VERSION_ID/validate
```

## Support

- [Supabase Docs](https://supabase.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [Vercel Docs](https://vercel.com/docs)

