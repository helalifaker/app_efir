# EFIR Production Deployment Guide

This guide walks you through deploying EFIR to Vercel.

## Prerequisites

- Vercel account ([sign up](https://vercel.com/signup))
- Supabase project with database configured
- GitHub repository with EFIR code

## Step 1: Database Setup

### 1.1 Run SQL Schema

1. Go to your Supabase project → SQL Editor
2. Run `sql/schema.sql` to create all tables
3. Run `sql/rls_policies.sql` to enable Row Level Security
4. Run `sql/seed.sql` to add test data (optional)

**IMPORTANT**: Run scripts in this order! RLS policies depend on schema being created first.

## Step 2: Environment Variables

### Required Variables

Add these to your Vercel project settings (Settings → Environment Variables):

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Where to Find Keys

1. Go to Supabase Dashboard → Settings → API
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

## Step 3: Vercel Deployment

### Option A: Deploy via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)
4. Add environment variables (from Step 2)
5. Click **Deploy**

### Option B: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (follow prompts)
vercel

# Deploy to production
vercel --prod
```

## Step 4: Post-Deployment Verification

### 4.1 Check Health

Visit your deployment URL + `/api/supabase-test` to verify database connectivity:

```
https://YOUR_APP.vercel.app/api/supabase-test
```

Expected response:
```json
{
  "ok": true,
  "stage": "auth.getUser",
  "env": {
    "url": "set",
    "anon": "set"
  },
  "user": null
}
```

### 4.2 Test Core Features

1. **Dashboard**: `https://YOUR_APP.vercel.app/dashboard`
2. **Versions**: `https://YOUR_APP.vercel.app/versions`
3. **Compare**: `https://YOUR_APP.vercel.app/compare`
4. **Admin**: `https://YOUR_APP.vercel.app/admin`

### 4.3 Database Verification

Run these in Supabase SQL Editor:

```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('models', 'model_versions', 'version_tabs', 'version_validations', 'version_status_history', 'app_settings');

-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('models', 'model_versions');

-- Verify app_settings has defaults
SELECT * FROM app_settings;

-- Verify models/versions exist
SELECT COUNT(*) FROM models;
SELECT COUNT(*) FROM model_versions;
```

## Step 5: Continuous Deployment

Once connected to GitHub, Vercel will:
- Auto-deploy on pushes to `main`
- Create preview deployments for PRs
- Run `npm run build` on every deploy

## Troubleshooting

### Build Fails

**Error**: "Module not found"
- **Fix**: Ensure `package-lock.json` is committed to git

**Error**: "Environment variable missing"
- **Fix**: Double-check Vercel env vars are set for Production, Preview, and Development

**Error**: "Database connection failed"
- **Fix**: Verify Supabase project is not paused (Supabase → Settings → General)

### Runtime Errors

**Error**: "502 Bad Gateway"
- **Fix**: Check Vercel logs → Functions tab for server errors

**Error**: "Cannot read property of undefined"
- **Fix**: Verify database tables exist and have seed data

**Error**: "Auth session expired"
- **Fix**: Clear cookies and re-login

## Production Checklist

- [ ] All environment variables set in Vercel
- [ ] Database schema created via SQL scripts
- [ ] RLS policies enabled and verified
- [ ] Seed data added (at least one model + version)
- [ ] Build succeeds (`npm run build`)
- [ ] Health check passes (`/api/supabase-test`)
- [ ] Core features tested (versions, compare, admin)
- [ ] Custom domain configured (optional)
- [ ] Monitoring/analytics enabled (optional)

## Security Notes

- ✅ `SUPABASE_SERVICE_ROLE_KEY` is never exposed to client
- ✅ RLS policies protect database access
- ✅ API routes validate all inputs
- ✅ HTTPS enforced by Vercel
- ✅ No hardcoded secrets in code

## Support

- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
- EFIR Repo: [your-repo-url]

