// scripts/migrate-to-statement-lines.ts
// Migration script to populate version_statement_lines from existing version_tabs data
//
// This script:
// 1. Reads all version_tabs data (pnl, bs, cf)
// 2. Initializes statement lines from metric_catalog
// 3. Optionally syncs values from version_tabs JSONB to version_metrics
//
// Usage:
//   npx tsx scripts/migrate-to-statement-lines.ts [versionId]
//   If versionId is provided, only migrates that version
//   If omitted, migrates all versions
//
// Environment variables required:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';
// Load .env.local automatically (Next.js convention)
// This allows the script to work with the same .env.local file used by Next.js
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local from project root
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', serviceKey ? '✓' : '✗');
  console.error('\nPlease set these in your environment or .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function migrateToStatementLines(versionId?: string) {

  console.log('🔄 Starting migration to statement lines...\n');

  // Get versions to migrate
  let versionsQuery = supabase
    .from('model_versions')
    .select('id, name, status');

  if (versionId) {
    versionsQuery = versionsQuery.eq('id', versionId);
  }

  const { data: versions, error: versionsError } = await versionsQuery;

  if (versionsError) {
    console.error('❌ Failed to fetch versions:', versionsError);
    process.exit(1);
  }

  if (!versions || versions.length === 0) {
    console.log('ℹ️  No versions found to migrate.');
    return;
  }

  console.log(`📊 Found ${versions.length} version(s) to migrate\n`);

  let successCount = 0;
  let errorCount = 0;

  // Migrate each version
  for (const version of versions) {
    console.log(`📝 Processing version: ${version.name} (${version.id})`);

    try {
      // Check which statement types exist for this version
      const { data: tabs } = await supabase
        .from('version_tabs')
        .select('tab')
        .eq('version_id', version.id)
        .in('tab', ['pnl', 'bs', 'cf']);

      const statementTypes = (tabs || []).map(t => t.tab as 'pnl' | 'bs' | 'cf');

      if (statementTypes.length === 0) {
        console.log(`   ⚠️  No statement tabs found, skipping...\n`);
        continue;
      }

      console.log(`   📋 Found statement types: ${statementTypes.join(', ')}`);

      // Initialize statement lines for each statement type
      for (const statementType of statementTypes) {
        // Use direct Supabase client instead of helper (which uses getServiceClient)
        const { data: metrics, error: metricsError } = await supabase
          .from('metric_catalog')
          .select('metric_key, row_key, row_label, is_calculated, display_order, formula')
          .eq('statement_type', statementType)
          .not('row_key', 'is', null)
          .not('row_label', 'is', null)
          .not('display_order', 'is', null)
          .order('display_order', { ascending: true });

        if (metricsError || !metrics) {
          console.error(`   ❌ Failed to fetch metrics for ${statementType.toUpperCase()}: ${metricsError?.message || 'Unknown error'}`);
          errorCount++;
          continue;
        }

        // Build statement lines from catalog
        const lines = metrics.map((metric) => {
          const rowKeyParts = metric.row_key!.split('.');
          const level = rowKeyParts.length - 1;
          const parentRowKey = rowKeyParts.length > 1 
            ? rowKeyParts.slice(0, -1).join('.')
            : null;

          return {
            version_id: version.id,
            statement_type: statementType,
            row_key: metric.row_key!,
            row_label: metric.row_label!,
            display_order: metric.display_order!,
            parent_row_key: parentRowKey,
            level,
            is_calculated: metric.is_calculated,
            is_subtotal: false,
            formula: metric.formula || null,
          };
        });

        // Delete existing lines for this statement type
        const { error: deleteError } = await supabase
          .from('version_statement_lines')
          .delete()
          .eq('version_id', version.id)
          .eq('statement_type', statementType);

        if (deleteError) {
          console.error(`   ❌ Failed to delete existing ${statementType.toUpperCase()} lines: ${deleteError.message}`);
          errorCount++;
          continue;
        }

        // Insert new lines
        if (lines.length > 0) {
          const { error: insertError } = await supabase
            .from('version_statement_lines')
            .insert(lines);

          if (insertError) {
            console.error(`   ❌ Failed to insert ${statementType.toUpperCase()} lines: ${insertError.message}`);
            errorCount++;
            continue;
          }
        }

        console.log(`   ✅ Initialized ${lines.length} ${statementType.toUpperCase()} lines`);
      }

      successCount++;
      console.log(`   ✅ Version migrated successfully\n`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`   ❌ Error migrating version: ${errorMessage}\n`);
      errorCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📝 Total: ${versions.length}`);
  console.log('='.repeat(50) + '\n');

  if (errorCount > 0) {
    process.exit(1);
  }
}

// Run migration
const versionId = process.argv[2];
migrateToStatementLines(versionId)
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });

