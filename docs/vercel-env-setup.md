# Vercel Environment Variables Setup

## Quick Fix for "Application error" on Vercel

If you're seeing "Application error: a server-side exception has occurred", it's likely because environment variables are missing.

## Required Environment Variables

Go to **Vercel Dashboard → Your Project → Settings → Environment Variables** and add:

### 1. `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: Your Supabase project URL
- **Example**: `https://xxxxx.supabase.co`
- **Where to find**: Supabase Dashboard → Settings → API → Project URL

### 2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: Your Supabase anon/public key
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to find**: Supabase Dashboard → Settings → API → anon public key

### 3. `SUPABASE_SERVICE_ROLE_KEY`
- **Value**: Your Supabase service_role key (⚠️ SECRET!)
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to find**: Supabase Dashboard → Settings → API → service_role secret key

## Important: Apply to All Environments

When adding environment variables, make sure to check:
- ✅ **Production**
- ✅ **Preview**
- ✅ **Development**

Or use the dropdown to apply to "Production, Preview, and Development".

## After Adding Variables

1. **Redeploy**: Go to Deployments → Click the three dots on the latest deployment → "Redeploy"
2. **Or**: Push a new commit to trigger a new deployment

## Verify Setup

After redeploying, check:
- Visit `https://YOUR_APP.vercel.app/api/supabase-test`
- Should return: `{"ok": true, "env": {"url": "set", "anon": "set"}}`

If you see `"missing"` for any env var, double-check the variable name and that it's applied to the correct environment.

## Optional: Sentry (if using)

If you're using Sentry for error monitoring, also add:
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

These are optional and won't break the app if missing.

