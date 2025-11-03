# EFIR Production Deployment Checklist

## ✅ Pre-Flight Checks

- [x] **Build Success**: `npm run build` passes without errors
- [x] **No Linter Errors**: `npm run lint` clean
- [x] **RLS Policies**: SQL files created and tested
- [x] **Service Role**: Never exposed to client
- [x] **Documentation**: Complete setup and security docs
- [x] **Schema**: All tables defined with constraints
- [x] **Seed Data**: Optional test data available

## 📋 Database Setup (Supabase)

Run these SQL scripts **in order** in Supabase SQL Editor:

1. [x] **`sql/schema.sql`** - Creates all tables including profiles
2. [x] **`sql/rls_policies.sql`** - Enables Row Level Security
3. [ ] **`sql/seed.sql`** - Add test data (optional)

**Verify**:
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;
```

Expected output should show:
- `profiles`
- `models`
- `model_versions`
- `version_tabs`
- `version_validations`
- `version_status_history`
- `app_settings`

## 🔐 Environment Variables (Vercel)

Add to Vercel project → Settings → Environment Variables:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon/public key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Service role key (SECRET!)

**Where to find**:
1. Supabase Dashboard → Settings → API
2. Copy values to Vercel

## 🚀 Deployment

### Option A: Vercel Dashboard

1. [ ] Go to [vercel.com/new](https://vercel.com/new)
2. [ ] Import GitHub repository
3. [ ] Configure:
   - Framework: Next.js
   - Build Command: `npm run build` (auto)
   - Output Directory: `.next` (auto)
4. [ ] Add environment variables
5. [ ] Click Deploy

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

## ✅ Post-Deployment Verification

### Health Checks

1. [ ] **App loads**: Visit deployment URL
2. [ ] **API works**: `/api/supabase-test` returns `{"ok": true}`
3. [ ] **Database**: Can view/create models and versions
4. [ ] **Compare**: Compare page loads and works
5. [ ] **Admin**: Admin settings page accessible

### Feature Tests

1. [ ] Create a new model
2. [ ] Create a new version with tabs
3. [ ] Validate version (should check required tabs)
4. [ ] Change status (draft → ready → locked)
5. [ ] View status history
6. [ ] Compare multiple versions
7. [ ] Export CSV from compare page
8. [ ] Print financial report
9. [ ] Update admin settings

### Security Checks

1. [ ] RLS enabled on data tables
2. [ ] Service role key not exposed in client
3. [ ] User can only see their own models
4. [ ] No unauthorized access to others' data
5. [ ] API routes require proper authentication (if added)

## 📝 Configuration

### App Settings

Default settings are seeded in `app_settings` table:

- **VAT Rate**: 15%
- **Number Format**: en-US, 2 decimals
- **Validation**: Requires overview/pnl/bs/cf tabs
- **UI**: SAR currency, system theme

Update via `/admin` page after deployment.

### Region

Current Vercel config uses `iad1` (US East).

To change, update `vercel.json`:
```json
{
  "regions": ["iad1", "sfo1"]
}
```

## 🐛 Troubleshooting

### Build Fails

**Error**: "Module not found"
- Check `package-lock.json` is committed
- Run `npm install` locally
- Retry deployment

**Error**: "Environment variable missing"
- Verify all 3 env vars are set in Vercel
- Apply to Production, Preview, and Development

### Runtime Errors

**Error**: "502 Bad Gateway"
- Check Vercel logs → Functions tab
- Verify Supabase project is running
- Check service role key is correct

**Error**: "Cannot read property of undefined"
- Verify database has seed data
- Run `sql/seed.sql` in Supabase

**Error**: "RLS policy violation"
- RLS is working correctly
- Ensure user is authenticated
- Verify model ownership

### Database Issues

**Error**: "Table does not exist"
- Re-run `sql/schema.sql`
- Check table names match code

**Error**: "Permission denied"
- Check RLS policies in `sql/rls_policies.sql`
- Verify service role key is set
- Check user has proper auth

## 📚 Documentation

All docs are in `docs/`:

- **`setup.md`** - First-time setup
- **`deploy.md`** - Deployment guide
- **`security.md`** - Security & RLS details
- **`RLS_IMPLEMENTATION.md`** - RLS technical summary

## 🎯 Success Criteria

Deployment is successful when:

1. ✅ App loads without errors
2. ✅ Database connection works
3. ✅ Users can create/view their models
4. ✅ Compare feature works
5. ✅ All pages render correctly
6. ✅ No console errors
7. ✅ Build passes on Vercel
8. ✅ RLS policies enforce data isolation

## 🚨 Critical Reminders

1. **Never commit** `SUPABASE_SERVICE_ROLE_KEY` to git
2. **Always use** service role in API routes
3. **Keep** RLS enabled in production
4. **Monitor** Vercel logs for errors
5. **Test** with real users before launch

## 🎉 You're Done!

Your EFIR app is now deployed to production with:
- ✅ Row-Level Security
- ✅ Service role protection
- ✅ Complete documentation
- ✅ Working features
- ✅ Clean builds

**Next**: Monitor usage, collect feedback, iterate!

