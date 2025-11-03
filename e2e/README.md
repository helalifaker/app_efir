# E2E Tests with Playwright

End-to-end tests for EFIR core flows using Playwright.

## Setup

### 1. Install Dependencies

```bash
npm install
npm run playwright:install
```

### 2. Seed Test Data

```bash
# Set environment variables
export NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
export SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Seed test data
npm run seed:test
```

This creates:
- Test model: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
- Test version (with validation errors): `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`
- Clone source version: `cccccccc-cccc-cccc-cccc-cccccccccccc`

### 3. Run Tests

```bash
# Run all tests (headless)
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug
```

## Test Coverage

### Version Detail Flow

- ✅ Display version details and tabs
- ✅ Show blocking validation when trying to set READY
- ✅ Successfully set READY after removing validation
- ✅ Lock version and update history

### Clone Flow

- ✅ Clone version and navigate to new id

## Test Structure

```
e2e/
  version-flow.spec.ts    # Main test suite
  fixtures/
    test-helpers.ts       # Helper functions (not used, inline in spec)
```

## Environment Variables

Required for tests:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_key
PLAYWRIGHT_BASE_URL=http://localhost:3000  # Optional, defaults to localhost:3000
```

## CI/CD

Tests run automatically on:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`

See `.github/workflows/e2e.yml` for CI configuration.

## Debugging

1. **Run in headed mode**: See what the browser is doing
   ```bash
   npm run test:e2e:headed
   ```

2. **Use Playwright UI**: Interactive test runner
   ```bash
   npm run test:e2e:ui
   ```

3. **Debug specific test**: Step through execution
   ```bash
   npm run test:e2e:debug
   ```

4. **Check test report**: After running tests, open `playwright-report/index.html`

## Test Data Management

Test data is seeded with fixed UUIDs:
- Model: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
- Version: `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`
- Clone Source: `cccccccc-cccc-cccc-cccc-cccccccccccc`

Tests use service key to manipulate data during execution:
- Remove validations
- Add tabs
- Set status

## Troubleshooting

### Tests fail with "Version not found"

- Run `npm run seed:test` to create test data
- Verify environment variables are set
- Check Supabase connection

### Tests fail with timeout

- Ensure dev server is running (`npm run dev`)
- Check `PLAYWRIGHT_BASE_URL` is correct
- Increase timeout in `playwright.config.ts` if needed

### Browser not found

```bash
npm run playwright:install
```

### Environment variables missing

```bash
export NEXT_PUBLIC_SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
```

## Best Practices

- ✅ Use fixed test IDs for predictable tests
- ✅ Clean up test data between runs (or use separate test DB)
- ✅ Use service key for test data manipulation
- ✅ Test both success and failure paths
- ✅ Verify UI state changes after actions

