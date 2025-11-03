#!/bin/bash
# tests/test-validation.sh
# Manual test script for API validation
# Run with: bash tests/test-validation.sh

BASE_URL="${BASE_URL:-http://localhost:3000}"
VALID_UUID="22222222-2222-2222-2222-222222222222"

echo "Testing API route validation..."
echo "Base URL: $BASE_URL"
echo ""

# Test 1: Invalid UUID in clone route
echo "Test 1: Invalid UUID in clone route"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/versions/invalid-uuid/clone" \
  -H "Content-Type: application/json" \
  -d '{}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "Status: $HTTP_CODE"
echo "Response: $BODY"
if [ "$HTTP_CODE" != "400" ]; then
  echo "❌ FAILED: Expected 400, got $HTTP_CODE"
else
  echo "✅ PASSED"
fi
echo ""

# Test 2: Invalid name type in clone
echo "Test 2: Invalid name type (number instead of string)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/versions/$VALID_UUID/clone" \
  -H "Content-Type: application/json" \
  -d '{"name": 123}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "Status: $HTTP_CODE"
echo "Response: $BODY"
if [ "$HTTP_CODE" != "400" ]; then
  echo "❌ FAILED: Expected 400, got $HTTP_CODE"
else
  echo "✅ PASSED"
fi
echo ""

# Test 3: Invalid includeChildren type
echo "Test 3: Invalid includeChildren type (string instead of boolean)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/versions/$VALID_UUID/clone" \
  -H "Content-Type: application/json" \
  -d '{"includeChildren": "yes"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "Status: $HTTP_CODE"
echo "Response: $BODY"
if [ "$HTTP_CODE" != "400" ]; then
  echo "❌ FAILED: Expected 400, got $HTTP_CODE"
else
  echo "✅ PASSED"
fi
echo ""

# Test 4: Invalid status enum
echo "Test 4: Invalid status enum value"
RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/api/versions/$VALID_UUID/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "invalid-status"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "Status: $HTTP_CODE"
echo "Response: $BODY"
if [ "$HTTP_CODE" != "400" ]; then
  echo "❌ FAILED: Expected 400, got $HTTP_CODE"
else
  echo "✅ PASSED"
fi
echo ""

# Test 5: Missing required status field
echo "Test 5: Missing required status field"
RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/api/versions/$VALID_UUID/status" \
  -H "Content-Type: application/json" \
  -d '{}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "Status: $HTTP_CODE"
echo "Response: $BODY"
if [ "$HTTP_CODE" != "400" ]; then
  echo "❌ FAILED: Expected 400, got $HTTP_CODE"
else
  echo "✅ PASSED"
fi
echo ""

# Test 6: Invalid UUID in validate route
echo "Test 6: Invalid UUID in validate route"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/versions/bad-uuid/validate")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "Status: $HTTP_CODE"
echo "Response: $BODY"
if [ "$HTTP_CODE" != "400" ]; then
  echo "❌ FAILED: Expected 400, got $HTTP_CODE"
else
  echo "✅ PASSED"
fi
echo ""

# Test 7: Invalid UUID in history route
echo "Test 7: Invalid UUID in history route"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/versions/not-valid-uuid/history")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
echo "Status: $HTTP_CODE"
echo "Response: $BODY"
if [ "$HTTP_CODE" != "400" ]; then
  echo "❌ FAILED: Expected 400, got $HTTP_CODE"
else
  echo "✅ PASSED"
fi
echo ""

echo "All tests completed!"

