// tests/export-utils.test.ts
// Unit tests for export data transformation (without browser dependencies)

/**
 * Test the jsonToRows function logic
 * This verifies stable ordering and nested data handling
 */

// Sample payload 1: Simple P&L data
const samplePnlData = {
  revenue: 1000000,
  cost_of_sales: 400000,
  gross_profit: 600000,
  operating_expenses: 200000,
  ebit: 400000,
  net_income: 300000,
};

// Sample payload 2: Nested balance sheet data
const sampleBsData = {
  assets: {
    current: {
      cash: 500000,
      receivables: 200000,
      inventory: 100000,
    },
    fixed: {
      property: 2000000,
      equipment: 500000,
    },
  },
  liabilities: {
    current: 300000,
    long_term: 1000000,
  },
  equity: 2900000,
};

// Replicate jsonToRows logic for testing
function jsonToRows(data: Record<string, unknown>, prefix = ''): Array<{ key: string; value: string | number }> {
  const rows: Array<{ key: string; value: string | number }> = [];
  const keys = Object.keys(data).sort(); // Stable ordering
  
  for (const key of keys) {
    const value = data[key];
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (value === null || value === undefined) {
      rows.push({ key: fullKey, value: '' });
    } else if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
      // Recursively process nested objects
      rows.push(...jsonToRows(value, fullKey));
    } else if (Array.isArray(value)) {
      // Handle arrays
      if (value.length === 0) {
        rows.push({ key: fullKey, value: '' });
      } else if (value.every(item => typeof item === 'object' && item !== null)) {
        // Array of objects - flatten each item
        value.forEach((item, index) => {
          rows.push(...jsonToRows(item, `${fullKey}[${index}]`));
        });
      } else {
        rows.push({ key: fullKey, value: value.join(', ') });
      }
    } else {
      rows.push({ key: fullKey, value });
    }
  }
  
  return rows;
}

// Test runner
function runTests() {
  console.log('🧪 Running export utility tests...\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Simple P&L data ordering
  try {
    const rows = jsonToRows(samplePnlData);
    const keys = rows.map(r => r.key);
    
    // Verify stable ordering (alphabetical)
    const expectedOrder = [
      'cost_of_sales',
      'ebit',
      'gross_profit',
      'net_income',
      'operating_expenses',
      'revenue',
    ];
    
    if (JSON.stringify(keys) === JSON.stringify(expectedOrder)) {
      console.log('✅ Test 1: Simple P&L ordering - PASSED');
      passed++;
    } else {
      throw new Error(`Expected ${expectedOrder}, got ${keys}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Test 1: Simple P&L ordering - FAILED:', errorMessage);
    failed++;
  }

  // Test 2: Nested BS data flattening
  try {
    const rows = jsonToRows(sampleBsData);
    const keys = rows.map(r => r.key);
    
    // Verify nested structure is flattened
    const expectedKeys = [
      'assets.current.cash',
      'assets.current.inventory',
      'assets.current.receivables',
      'assets.fixed.equipment',
      'assets.fixed.property',
      'equity',
      'liabilities.current',
      'liabilities.long_term',
    ];
    
    const allMatch = expectedKeys.every(key => keys.includes(key));
    if (allMatch && keys.length === expectedKeys.length) {
      console.log('✅ Test 2: Nested BS flattening - PASSED');
      passed++;
    } else {
      throw new Error(`Missing keys. Expected ${expectedKeys.length}, got ${keys.length}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Test 2: Nested BS flattening - FAILED:', errorMessage);
    failed++;
  }

  // Test 3: Array handling
  try {
    const arrayData = {
      projects: [
        { name: 'Project A', amount: 100000 },
        { name: 'Project B', amount: 200000 },
      ],
    };
    
    const rows = jsonToRows(arrayData);
    const keys = rows.map(r => r.key);
    
    // Verify array of objects is flattened
    const expectedKeys = [
      'projects[0].amount',
      'projects[0].name',
      'projects[1].amount',
      'projects[1].name',
    ];
    
    const allMatch = expectedKeys.every(key => keys.includes(key));
    if (allMatch) {
      console.log('✅ Test 3: Array of objects flattening - PASSED');
      passed++;
    } else {
      throw new Error(`Array flattening failed. Got: ${keys.join(', ')}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Test 3: Array handling - FAILED:', errorMessage);
    failed++;
  }

  // Test 4: Null/undefined handling
  try {
    const nullData = {
      value1: 100,
      value2: null,
      value3: undefined,
      value4: 200,
    };
    
    const rows = jsonToRows(nullData);
    const nullRows = rows.filter(r => r.value === '');
    
    if (nullRows.length === 2) {
      console.log('✅ Test 4: Null/undefined handling - PASSED');
      passed++;
    } else {
      throw new Error(`Expected 2 null values, got ${nullRows.length}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Test 4: Null/undefined handling - FAILED:', errorMessage);
    failed++;
  }

  // Test 5: Empty object handling
  try {
    const emptyData = {};
    const rows = jsonToRows(emptyData);
    
    if (rows.length === 0) {
      console.log('✅ Test 5: Empty object handling - PASSED');
      passed++;
    } else {
      throw new Error(`Expected 0 rows, got ${rows.length}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Test 5: Empty object handling - FAILED:', errorMessage);
    failed++;
  }

  // Test 6: Simple array handling
  try {
    const simpleArray = {
      tags: ['tag1', 'tag2', 'tag3'],
    };
    
    const rows = jsonToRows(simpleArray);
    const tagRow = rows.find(r => r.key === 'tags');
    
    if (tagRow && tagRow.value === 'tag1, tag2, tag3') {
      console.log('✅ Test 6: Simple array handling - PASSED');
      passed++;
    } else {
      throw new Error(`Expected comma-separated string, got ${tagRow?.value}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Test 6: Simple array handling - FAILED:', errorMessage);
    failed++;
  }

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests();

