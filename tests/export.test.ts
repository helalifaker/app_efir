// tests/export.test.ts
// Tests for CSV and XLSX export functions
// Note: These tests verify the functions don't throw errors
// Actual file downloads are tested manually in the browser

import { exportTabToCsv } from '../lib/csv';
import { exportTabToExcel, exportCompareToExcel } from '../lib/xlsx';

// Sample payload 1: Simple P&L data
const samplePnlData = {
  revenue: 1000000,
  cost_of_sales: 400000,
  gross_profit: 600000,
  operating_expenses: 200000,
  ebit: 400000,
  net_income: 300000,
};

const sampleMetadata1 = {
  modelName: 'Test Model',
  versionName: 'Q1 2024',
  status: 'ready',
  createdAt: '2024-01-15T10:00:00Z',
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

const sampleMetadata2 = {
  modelName: 'Complex Model',
  versionName: 'Year End 2024',
  status: 'locked',
  createdAt: '2024-12-31T23:59:59Z',
};

// Test runner (simple assertion-based)
async function runTests() {
  console.log('🧪 Running export function tests...\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Simple P&L CSV export
  try {
    await exportTabToCsv({
      tabName: 'pnl',
      data: samplePnlData,
      metadata: sampleMetadata1,
      filename: 'test_pnl_export.csv',
    });
    console.log('✅ Test 1: Simple P&L CSV export - PASSED');
    passed++;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Test 1: Simple P&L CSV export - FAILED:', errorMessage);
    failed++;
  }

  // Test 2: Nested BS CSV export
  try {
    await exportTabToCsv({
      tabName: 'bs',
      data: sampleBsData,
      metadata: sampleMetadata2,
      filename: 'test_bs_export.csv',
    });
    console.log('✅ Test 2: Nested Balance Sheet CSV export - PASSED');
    passed++;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Test 2: Nested Balance Sheet CSV export - FAILED:', errorMessage);
    failed++;
  }

  // Test 3: Simple P&L Excel export
  try {
    await exportTabToExcel({
      tabName: 'pnl',
      data: samplePnlData,
      metadata: sampleMetadata1,
      filename: 'test_pnl_export.xlsx',
    });
    console.log('✅ Test 3: Simple P&L Excel export - PASSED');
    passed++;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Test 3: Simple P&L Excel export - FAILED:', errorMessage);
    failed++;
  }

  // Test 4: Nested BS Excel export
  try {
    await exportTabToExcel({
      tabName: 'bs',
      data: sampleBsData,
      metadata: sampleMetadata2,
      filename: 'test_bs_export.xlsx',
    });
    console.log('✅ Test 4: Nested Balance Sheet Excel export - PASSED');
    passed++;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Test 4: Nested Balance Sheet Excel export - FAILED:', errorMessage);
    failed++;
  }

  // Test 5: Comparison Excel export
  const sampleVersions = [
    {
      id: 'v1',
      name: 'Baseline 2024',
      status: 'locked',
      model_name: 'Test Model',
    },
    {
      id: 'v2',
      name: 'Scenario A',
      status: 'ready',
      model_name: 'Test Model',
    },
    {
      id: 'v3',
      name: 'Scenario B',
      status: 'ready',
      model_name: 'Test Model',
    },
  ];

  const sampleDataByVersion = {
    v1: { revenue: 1000000, ebit: 400000, net_income: 300000 },
    v2: { revenue: 1200000, ebit: 500000, net_income: 400000 },
    v3: { revenue: 900000, ebit: 300000, net_income: 200000 },
  };

  try {
    await exportCompareToExcel({
      tabName: 'pnl',
      versions: sampleVersions,
      baselineId: 'v1',
      dataByVersion: sampleDataByVersion,
      allKeys: ['revenue', 'ebit', 'net_income'],
      filename: 'test_compare_export.xlsx',
    });
    console.log('✅ Test 5: Comparison Excel export - PASSED');
    passed++;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Test 5: Comparison Excel export - FAILED:', errorMessage);
    failed++;
  }

  // Test 6: Missing data handling
  try {
    await exportCompareToExcel({
      tabName: 'pnl',
      versions: sampleVersions.slice(0, 2),
      baselineId: 'v1',
      dataByVersion: {
        v1: { revenue: 1000000 },
        v2: { revenue: 1200000, ebit: 500000 },
      },
      allKeys: ['revenue', 'ebit'],
      filename: 'test_partial_export.xlsx',
    });
    console.log('✅ Test 6: Partial data export - PASSED');
    passed++;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Test 6: Partial data export - FAILED:', errorMessage);
    failed++;
  }

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
