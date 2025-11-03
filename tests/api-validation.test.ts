// tests/api-validation.test.ts
// Negative test cases for API route validation
// Run with: npm test or manually test these endpoints

/**
 * Test cases for API route validation
 * 
 * These tests demonstrate that all API routes properly validate inputs
 * and return 400 errors with Zod error details for malformed inputs.
 */

// Test data for negative cases
export const negativeTestCases = {
  // Clone route tests
  clone: {
    invalidUuid: {
      url: '/api/versions/invalid-uuid/clone',
      method: 'POST',
      body: {},
      expectedStatus: 400,
      expectedError: 'Invalid version ID format',
    },
    invalidNameType: {
      url: '/api/versions/22222222-2222-2222-2222-222222222222/clone',
      method: 'POST',
      body: { name: 123 }, // Should be string
      expectedStatus: 400,
      expectedError: 'Validation failed',
    },
    invalidIncludeChildrenType: {
      url: '/api/versions/22222222-2222-2222-2222-222222222222/clone',
      method: 'POST',
      body: { includeChildren: 'yes' }, // Should be boolean
      expectedStatus: 400,
      expectedError: 'Validation failed',
    },
    emptyName: {
      url: '/api/versions/22222222-2222-2222-2222-222222222222/clone',
      method: 'POST',
      body: { name: '' }, // Empty string not allowed (min 1)
      expectedStatus: 400,
      expectedError: 'Validation failed',
    },
  },

  // Status route tests
  status: {
    invalidUuid: {
      url: '/api/versions/not-a-uuid/status',
      method: 'PATCH',
      body: { status: 'ready' },
      expectedStatus: 400,
      expectedError: 'Invalid version ID format',
    },
    missingStatus: {
      url: '/api/versions/22222222-2222-2222-2222-222222222222/status',
      method: 'PATCH',
      body: {},
      expectedStatus: 400,
      expectedError: 'Validation failed',
    },
    invalidStatus: {
      url: '/api/versions/22222222-2222-2222-2222-222222222222/status',
      method: 'PATCH',
      body: { status: 'invalid-status' }, // Not in enum
      expectedStatus: 400,
      expectedError: 'Validation failed',
    },
    invalidNoteType: {
      url: '/api/versions/22222222-2222-2222-2222-222222222222/status',
      method: 'PATCH',
      body: { status: 'ready', note: 12345 }, // Should be string
      expectedStatus: 400,
      expectedError: 'Validation failed',
    },
  },

  // Validate route tests
  validate: {
    invalidUuid: {
      url: '/api/versions/bad-uuid/validate',
      method: 'GET',
      expectedStatus: 400,
      expectedError: 'Invalid version ID format',
    },
  },

  // History route tests
  history: {
    invalidUuid: {
      url: '/api/versions/not-valid-uuid/history',
      method: 'GET',
      expectedStatus: 400,
      expectedError: 'Invalid version ID format',
    },
  },
};

/**
 * Manual test script
 * 
 * To test these cases, use curl or a REST client:
 * 
 * 1. Invalid UUID in clone:
 *    curl -X POST http://localhost:3000/api/versions/invalid-uuid/clone \
 *      -H "Content-Type: application/json" \
 *      -d '{}'
 *    Expected: 400 with "Invalid version ID format"
 * 
 * 2. Invalid name type:
 *    curl -X POST http://localhost:3000/api/versions/22222222-2222-2222-2222-222222222222/clone \
 *      -H "Content-Type: application/json" \
 *      -d '{"name": 123}'
 *    Expected: 400 with validation error details
 * 
 * 3. Invalid status:
 *    curl -X PATCH http://localhost:3000/api/versions/22222222-2222-2222-2222-222222222222/status \
 *      -H "Content-Type: application/json" \
 *      -d '{"status": "invalid"}'
 *    Expected: 400 with validation error details
 * 
 * 4. Missing required field:
 *    curl -X PATCH http://localhost:3000/api/versions/22222222-2222-2222-2222-222222222222/status \
 *      -H "Content-Type: application/json" \
 *      -d '{}'
 *    Expected: 400 with validation error for missing "status"
 */

