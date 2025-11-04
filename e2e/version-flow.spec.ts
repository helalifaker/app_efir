// e2e/version-flow.spec.ts
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const TEST_VERSION_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CLONE_VERSION_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

// Test helpers using service key
function getTestSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE environment variables for tests');
  }
  return createClient(url, key);
}

async function removeValidations(versionId: string) {
  const supabase = getTestSupabase();
  const { error } = await supabase
    .from('version_validations')
    .delete()
    .eq('version_id', versionId)
    .eq('severity', 'error');
  if (error) throw new Error(`Failed to remove validations: ${error.message}`);
}

async function addTab(versionId: string, tab: string, data: Record<string, unknown>) {
  const supabase = getTestSupabase();
  const { error } = await supabase
    .from('version_tabs')
    .upsert({ version_id: versionId, tab, data }, { onConflict: 'version_id,tab' });
  if (error) throw new Error(`Failed to add tab: ${error.message}`);
}

// Blueprint: Status values are capitalized (Draft, Ready, Locked, Archived)
async function setVersionStatus(versionId: string, status: 'Draft' | 'Ready' | 'Locked' | 'Archived') {
  const supabase = getTestSupabase();
  const { error } = await supabase
    .from('model_versions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', versionId);
  if (error) throw new Error(`Failed to set status: ${error.message}`);
}

test.describe('Version Detail Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to version detail page
    await page.goto(`/versions/${TEST_VERSION_ID}/overview`);
  });

  test('should display version details and tabs', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('h1', { timeout: 10000 });

    // Check version name is displayed
    await expect(page.locator('h1')).toContainText('E2E Test Version');

    // Check status is displayed
    await expect(page.locator('text=Status')).toBeVisible();

    // Check tab navigation is displayed
    await expect(page.locator('nav')).toBeVisible();
    
    // Check specific tabs exist in navigation
    await expect(page.locator('text=Overview')).toBeVisible();
    await expect(page.locator('text=Assumptions')).toBeVisible();
    await expect(page.locator('text=P&L')).toBeVisible();
    await expect(page.locator('text=Balance Sheet')).toBeVisible();
    await expect(page.locator('text=Cash Flow')).toBeVisible();
    await expect(page.locator('text=CAPEX')).toBeVisible();
    await expect(page.locator('text=Validation')).toBeVisible();

    // Check validations section exists
    await expect(page.locator('text=Validations')).toBeVisible();
  });

  test('should show blocking validation when trying to set READY', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('button:has-text("Mark Ready")', { timeout: 10000 });

    // Check that validation error is visible
    await expect(page.locator('text=NO_PNL')).toBeVisible();
    await expect(page.locator('text=PNL tab is missing')).toBeVisible();

    // Click "Mark Ready" button
    const markReadyButton = page.locator('button:has-text("Mark Ready")');
    await expect(markReadyButton).toBeVisible();
    await markReadyButton.click();

    // Wait for toast notification
    // react-hot-toast creates toast elements with specific classes
    await page.waitForSelector('[role="status"]', { timeout: 5000 });

    // Check for error toast (blocking validation)
    const toast = page.locator('[role="status"]').first();
    await expect(toast).toBeVisible();
    
    // The toast should contain an error message
    // Note: The exact message depends on the API response
    const toastText = await toast.textContent();
    expect(toastText).toMatch(/failed|error|validation/i);
  });

  test('should successfully set READY after removing validation', async ({ page }) => {
    // Remove blocking validation errors and add missing tabs
    await removeValidations(TEST_VERSION_ID);
    await addTab(TEST_VERSION_ID, 'pnl', { revenue: 50000, ebit: 10000 });
    await addTab(TEST_VERSION_ID, 'bs', { assets: 100000, equity: 60000, liabilities: 40000 });
    await addTab(TEST_VERSION_ID, 'cf', { operating: 15000 });

    // Reload page to see updated state
    await page.reload();
    await page.waitForSelector('button:has-text("Mark Ready")', { timeout: 10000 });

    // Click "Mark Ready" button
    const markReadyButton = page.locator('button:has-text("Mark Ready")');
    await markReadyButton.click();

    // Wait for success toast
    await page.waitForSelector('[role="status"]', { timeout: 5000 });
    const toast = page.locator('[role="status"]').first();
    await expect(toast).toBeVisible();

    // Check for success message
    const toastText = await toast.textContent();
    expect(toastText?.toLowerCase()).toMatch(/ready|success|updated/i);

    // Verify status changed in UI
    await page.waitForTimeout(1000); // Wait for refresh
    await expect(page.locator('text=Status')).toContainText('ready');
  });

  test('should lock version and update history', async ({ page }) => {
    // Ensure version is in "ready" state first
    await setVersionStatus(TEST_VERSION_ID, 'ready');
    
    // Remove any blocking validations
    await removeValidations(TEST_VERSION_ID);
    await addTab(TEST_VERSION_ID, 'pnl', { revenue: 50000 });
    await addTab(TEST_VERSION_ID, 'bs', { assets: 100000, equity: 60000, liabilities: 40000 });
    await addTab(TEST_VERSION_ID, 'cf', { operating: 15000 });

    // Reload page
    await page.reload();
    await page.waitForSelector('button:has-text("Lock Version")', { timeout: 10000 });

    // Click "Lock Version" button
    const lockButton = page.locator('button:has-text("Lock Version")');
    await expect(lockButton).toBeVisible();
    await lockButton.click();

    // Wait for success toast
    await page.waitForSelector('[role="status"]', { timeout: 5000 });
    const toast = page.locator('[role="status"]').first();
    await expect(toast).toBeVisible();

    // Check for success message
    const toastText = await toast.textContent();
    expect(toastText?.toLowerCase()).toMatch(/locked|success/i);

    // Wait for page refresh
    await page.waitForTimeout(1000);

    // Verify status changed to locked
    await expect(page.locator('text=Status')).toContainText('locked');

    // Check history section updated
    const historySection = page.locator('text=History');
    await expect(historySection).toBeVisible();

    // Check that history shows the status change
    await expect(page.locator('text=ready')).toBeVisible();
    await expect(page.locator('text=locked')).toBeVisible();
  });
});

test.describe('Version Clone Flow', () => {
  test('should clone version and navigate to new id', async ({ page, request }) => {
    // Navigate to clone source version
    await page.goto(`/versions/${CLONE_VERSION_ID}/overview`);
    await page.waitForSelector('h1', { timeout: 10000 });

    // Get the current URL
    const initialUrl = page.url();

    // Clone via API (since we don't have a UI clone button yet)
    const cloneResponse = await request.post(
      `/api/versions/${CLONE_VERSION_ID}/clone`,
      {
        data: {
          name: 'E2E Cloned Version',
          includeChildren: true,
        },
      }
    );

    expect(cloneResponse.ok()).toBeTruthy();
    const cloneData = await cloneResponse.json();
    expect(cloneData.id).toBeDefined();
    expect(cloneData.name).toBe('E2E Cloned Version');

    // Navigate to the cloned version
    await page.goto(`/versions/${cloneData.id}/overview`);
    await page.waitForSelector('h1', { timeout: 10000 });

    // Verify we're on the new version's page
    expect(page.url()).toContain(cloneData.id);
    expect(page.url()).not.toBe(initialUrl);

    // Verify cloned version details
    await expect(page.locator('h1')).toContainText('E2E Cloned Version');
    await expect(page.locator('text=Status')).toContainText('draft'); // Cloned versions start as draft

    // Verify tabs were cloned (check navigation)
    await expect(page.locator('text=Overview')).toBeVisible();
    await expect(page.locator('text=P&L')).toBeVisible();
  });
});

