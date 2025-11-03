# E2E Testing Guide

EFIR uses **Playwright** for end-to-end testing of core user flows.

## Quick Start

### 1. Install & Setup

```bash
# Install dependencies (already in package.json)
npm install

# Install Playwright browsers
npm run playwright:install

# Seed test data
npm run seed:test
```

### 2. Run Tests

```bash
# Run all tests (headless)
npm run test:e2e

# Run with UI (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed
```

## Test Coverage

### ✅ Version Detail Flow

1. **Display version details and tabs**
   - Navigates to `/version-detail/{id}`
   - Verifies version name, status, and all 6 tabs are displayed
   - Checks validations section exists

2. **Blocking validation on READY transition**
   - Attempts to set status to "ready" with validation errors
   - Verifies error toast is shown
   - Validates that status change is blocked

3. **Successfully set READY after fixing validation**
   - Removes validation errors via test helper
   - Adds missing required tabs
   - Sets status to "ready"
   - Verifies success toast and UI update

4. **Lock version and update history**
   - Sets version to "ready" state
   - Locks the version
   - Verifies status change and history update

### ✅ Clone Flow

1. **Clone version and navigate**
   - Clones a version via API
   - Navigates to cloned version's detail page
   - Verifies cloned data (tabs, status)

## Test Data

Test data is seeded with fixed UUIDs for predictable tests:

- **Model ID**: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
- **Test Version ID**: `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` (with validation errors)
- **Clone Source ID**: `cccccccc-cccc-cccc-cccc-cccccccccccc` (ready, all tabs)

### Seeding Test Data

```bash
# Set environment variables
export NEXT_PUBLIC_SUPABASE_URL=your_url
export SUPABASE_SERVICE_ROLE_KEY=your_key

# Run seed script
npm run seed:test
```

The seed script creates:
- Test model with null owner (readable by all)
- Test version in "draft" status with missing tabs (triggers validation errors)
- Clone source version in "ready" status with all required tabs

## Test Helpers

Tests use service key to manipulate data during execution:

```typescript
// Remove validation errors
await removeValidations(versionId);

// Add tab data
await addTab(versionId, 'pnl', { revenue: 50000 });

// Set version status
await setVersionStatus(versionId, 'ready');
```

These helpers are defined inline in `e2e/version-flow.spec.ts` and use the service role key to bypass RLS.

## CI/CD Integration

### GitHub Actions

Tests run automatically on:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`

**Workflow**: `.github/workflows/e2e.yml`

**Steps**:
1. Install dependencies
2. Install Playwright browsers
3. Seed test data
4. Build application
5. Run Playwright tests
6. Upload test report artifact

### Required Secrets

Set these in GitHub repository settings:

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for test data

### Local CI Simulation

```bash
# Simulate CI environment
export CI=true
export NEXT_PUBLIC_SUPABASE_URL=your_url
export SUPABASE_SERVICE_ROLE_KEY=your_key

npm ci
npx playwright install --with-deps chromium
npm run seed:test
npm run build
npm run test:e2e
```

## Configuration

### Playwright Config

`playwright.config.ts`:
- Test directory: `./e2e`
- Base URL: `http://localhost:3000` (or `PLAYWRIGHT_BASE_URL`)
- Browser: Chromium
- Auto-start dev server (unless `CI=true`)

### Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Optional
PLAYWRIGHT_BASE_URL=http://localhost:3000  # Default
```

## Debugging

### View Test Report

After running tests:

```bash
npx playwright show-report
```

Opens HTML report with:
- Test results
- Screenshots on failure
- Video recordings (if enabled)
- Trace files (on retry)

### Debug Mode

```bash
# Step through test execution
npm run test:e2e:debug
```

Opens Playwright Inspector with:
- Step-by-step execution
- DOM inspector
- Console logs
- Network requests

### Common Issues

**"Version not found"**
- Run `npm run seed:test` to create test data
- Verify environment variables are set
- Check Supabase connection

**"Timeout waiting for selector"**
- Ensure dev server is running
- Check `PLAYWRIGHT_BASE_URL` is correct
- Increase timeout in `playwright.config.ts`

**"Browser not found"**
```bash
npm run playwright:install
```

**"Missing environment variables"**
- Check `.env.local` or export variables
- Verify service key has write access

## Best Practices

### ✅ DO

- Use fixed test IDs for predictable tests
- Use service key for test data manipulation
- Clean up between tests (or use separate test DB)
- Test both success and failure paths
- Verify UI state after actions
- Use meaningful test descriptions

### ❌ DON'T

- Use production database for tests
- Hardcode sensitive data in tests
- Skip cleanup between test runs
- Rely on timing without explicit waits
- Test implementation details

## Extending Tests

### Add New Test

1. Create test in `e2e/version-flow.spec.ts` or new file
2. Use test helpers for data manipulation
3. Follow existing patterns for assertions
4. Update seed script if new test data needed

### Example

```typescript
test('should do something', async ({ page }) => {
  await page.goto('/some-page');
  await expect(page.locator('h1')).toBeVisible();
  
  // Manipulate test data
  await addTab(versionId, 'newTab', { data: 'value' });
  
  // Verify UI update
  await page.reload();
  await expect(page.locator('text=New Tab')).toBeVisible();
});
```

## Test Reports

Test reports are generated in `playwright-report/`:
- HTML report (view in browser)
- Screenshots on failure
- Trace files (if enabled)

Reports are uploaded as artifacts in CI for easy debugging.

## Related

- [Playwright Docs](https://playwright.dev)
- [Test Data Seeding](./observability.md#test-data)
- [API Validation](./validation.md)

