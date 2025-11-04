// scripts/migrate-to-timeseries.ts
// Migration script to populate version_metrics from existing version_tabs data
//
// This script:
// 1. Reads existing version_tabs data (pnl, bs, cf)
// 2. Maps JSONB fields to metric keys
// 3. Inserts into version_metrics for year 2025 (baseline forecast)
// 4. Marks 2023-2024 as historical (is_historical=true) with null values
// 5. Initializes 2026-2052 with null values (can be filled later)
//
// Usage: tsx scripts/migrate-to-timeseries.ts [--dry-run] [--version-id=UUID]

import { createClient } from '@supabase/supabase-js';
import { HISTORY_YEARS } from '../types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', serviceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

// Mapping from version_tabs JSONB keys to version_metrics metric_key
const METRIC_MAPPINGS: Record<string, { tab: string; metricKey: string }[]> = {
  pnl: [
    { tab: 'pnl', metricKey: 'revenue' },
    { tab: 'pnl', metricKey: 'students_count' },
    { tab: 'pnl', metricKey: 'avg_tuition_fee' },
    { tab: 'pnl', metricKey: 'cost_of_sales' },
    { tab: 'pnl', metricKey: 'operating_expenses' },
    { tab: 'pnl', metricKey: 'ebit' },
    { tab: 'pnl', metricKey: 'net_income' },
  ],
  bs: [
    { tab: 'bs', metricKey: 'assets' },
    { tab: 'bs', metricKey: 'assets_current' },
    { tab: 'bs', metricKey: 'cash' },
    { tab: 'bs', metricKey: 'receivables' },
    { tab: 'bs', metricKey: 'assets_fixed' },
    { tab: 'bs', metricKey: 'liabilities' },
    { tab: 'bs', metricKey: 'liabilities_current' },
    { tab: 'bs', metricKey: 'debt' },
    { tab: 'bs', metricKey: 'equity' },
    { tab: 'bs', metricKey: 'retained_earnings' },
  ],
  cf: [
    { tab: 'cf', metricKey: 'cf_operating' },
    { tab: 'cf', metricKey: 'cf_investing' },
    { tab: 'cf', metricKey: 'cf_financing' },
    { tab: 'cf', metricKey: 'cash_beginning' },
    { tab: 'cf', metricKey: 'cash_ending' },
  ],
};

// Helper to extract numeric value from JSONB, handling nested objects
function extractValue(data: Record<string, unknown>, key: string): number | null {
  if (!data || typeof data !== 'object') return null;
  
  const value = data[key];
  if (value === null || value === undefined) return null;
  
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
}

async function migrateVersion(versionId: string, dryRun: boolean = false) {
  console.log(`\n📦 Migrating version: ${versionId}${dryRun ? ' (DRY RUN)' : ''}`);
  
  // 1. Fetch version_tabs for this version
  const { data: tabs, error: tabsError } = await supabase
    .from('version_tabs')
    .select('tab, data')
    .eq('version_id', versionId)
    .in('tab', ['pnl', 'bs', 'cf']);

  if (tabsError) {
    console.error(`❌ Error fetching tabs: ${tabsError.message}`);
    return false;
  }

  if (!tabs || tabs.length === 0) {
    console.log(`⚠️  No tabs found for version ${versionId}, skipping`);
    return false;
  }

  console.log(`✓ Found ${tabs.length} tab(s)`);

  // 2. Build metrics map from tabs
  const metricsToInsert: Array<{
    version_id: string;
    year: number;
    metric_key: string;
    value: number | null;
    is_historical: boolean;
  }> = [];

  // Process each tab
  tabs.forEach((tab: { tab: string; data: Record<string, unknown> | null }) => {
    const tabName = tab.tab as string;
    const mappings = METRIC_MAPPINGS[tabName] || [];
    const tabData = tab.data || {};

    mappings.forEach(({ metricKey }) => {
      const value = extractValue(tabData, metricKey);
      
      // Insert for year 2025 (baseline forecast)
      if (value !== null) {
        metricsToInsert.push({
          version_id: versionId,
          year: 2025,
          metric_key: metricKey,
          value,
          is_historical: false,
        });
      }

      // Mark 2023-2024 as historical (with null values, read-only)
      HISTORY_YEARS.forEach((year) => {
        metricsToInsert.push({
          version_id: versionId,
          year,
          metric_key: metricKey,
          value: null,
          is_historical: true,
        });
      });

      // Initialize 2026-2052 with null values
      for (let year = 2026; year <= 2052; year++) {
        metricsToInsert.push({
          version_id: versionId,
          year,
          metric_key: metricKey,
          value: null,
          is_historical: false,
        });
      }
    });
  });

  console.log(`✓ Prepared ${metricsToInsert.length} metric rows`);

  if (dryRun) {
    console.log('\n📋 DRY RUN - Would insert:');
    const byYear = metricsToInsert.reduce((acc, m) => {
      if (!acc[m.year]) acc[m.year] = [];
      acc[m.year].push(m.metric_key);
      return acc;
    }, {} as Record<number, string[]>);
    
    Object.keys(byYear).sort().forEach((year) => {
      const yearNum = parseInt(year);
      const isHistorical = yearNum === 2023 || yearNum === 2024;
      console.log(`  Year ${year} (${isHistorical ? 'HISTORICAL' : 'FORECAST'}): ${byYear[yearNum].length} metrics`);
    });
    return true;
  }

  // 3. Insert metrics (use upsert to handle duplicates)
  console.log('💾 Inserting metrics...');
  
  // Batch insert in chunks of 100
  const chunkSize = 100;
  for (let i = 0; i < metricsToInsert.length; i += chunkSize) {
    const chunk = metricsToInsert.slice(i, i + chunkSize);
    
    const { error: insertError } = await supabase
      .from('version_metrics')
      .upsert(
        chunk.map((m) => ({
          version_id: m.version_id,
          year: m.year,
          metric_key: m.metric_key,
          value: m.value,
          is_historical: m.is_historical,
        })),
        { onConflict: 'version_id,year,metric_key' }
      );

    if (insertError) {
      console.error(`❌ Error inserting chunk ${i / chunkSize + 1}: ${insertError.message}`);
      return false;
    }
  }

  console.log(`✅ Successfully migrated ${metricsToInsert.length} metrics`);
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const versionIdArg = args.find((arg) => arg.startsWith('--version-id='));
  const versionId = versionIdArg ? versionIdArg.split('=')[1] : null;

  console.log('🔄 Time-Series Migration Script');
  console.log('================================');
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made');
  }

  try {
    // If version ID specified, migrate only that version
    if (versionId) {
      const success = await migrateVersion(versionId, dryRun);
      if (!success) {
        process.exit(1);
      }
    } else {
      // Migrate all versions
      console.log('\n📋 Fetching all versions...');
      const { data: versions, error: versionsError } = await supabase
        .from('model_versions')
        .select('id, name')
        .order('created_at', { ascending: true });

      if (versionsError) {
        console.error(`❌ Error fetching versions: ${versionsError.message}`);
        process.exit(1);
      }

      if (!versions || versions.length === 0) {
        console.log('⚠️  No versions found to migrate');
        process.exit(0);
      }

      console.log(`✓ Found ${versions.length} version(s)`);

      let successCount = 0;
      let failCount = 0;

      for (const version of versions) {
        const success = await migrateVersion(version.id, dryRun);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      console.log('\n📊 Migration Summary:');
      console.log(`  ✅ Successful: ${successCount}`);
      console.log(`  ❌ Failed: ${failCount}`);
      console.log(`  📦 Total: ${versions.length}`);

      if (failCount > 0) {
        process.exit(1);
      }
    }

    console.log('\n✅ Migration complete!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('\n❌ Fatal error:', errorMessage);
    if (error instanceof Error) {
      console.error(error);
    }
    process.exit(1);
  }
}

main();
