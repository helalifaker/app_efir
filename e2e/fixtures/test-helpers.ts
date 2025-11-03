// e2e/fixtures/test-helpers.ts
// Test helpers for manipulating test data during e2e tests
// Uses API request context to manipulate test data

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

export async function removeValidations(versionId: string, request: any) {
  // Use direct Supabase client in test environment
  // For now, we'll add the missing tabs to fix validation instead
  // This is a workaround since we don't have a delete validations endpoint
}

export async function addTab(
  versionId: string,
  tab: string,
  data: Record<string, unknown>,
  request: any
) {
  // Try to add tab via API if endpoint exists
  // Otherwise, we'll need to use service key directly
  const response = await request.post(`${BASE_URL}/api/versions/${versionId}/tabs`, {
    data: {
      version_id: versionId,
      tab,
      data,
    },
    failOnStatusCode: false,
  });

  if (!response.ok()) {
    // If endpoint doesn't exist, we'll need to use service key
    // For now, return false to indicate failure
    return false;
  }
  return true;
}

export async function setVersionStatus(
  versionId: string,
  status: 'draft' | 'ready' | 'locked',
  request: any
) {
  const response = await request.patch(`${BASE_URL}/api/versions/${versionId}/status`, {
    data: { status },
    failOnStatusCode: false,
  });

  return response.ok();
}
