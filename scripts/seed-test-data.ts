// scripts/seed-test-data.ts
// Seed test data for e2e tests using service role key

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', serviceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function seedTestData() {
  console.log('🌱 Seeding test data...');

  // 1. Create or get test model
  const modelId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const { data: existingModel } = await supabase
    .from('models')
    .select('id')
    .eq('id', modelId)
    .single();

  if (!existingModel) {
    const { error: modelError } = await supabase
      .from('models')
      .insert({
        id: modelId,
        name: 'E2E Test Model',
        description: 'Test model for e2e tests',
        owner_id: null, // Allow all authenticated users to read
      });

    if (modelError) {
      console.error('Failed to create model:', modelError);
      process.exit(1);
    }
    console.log('✓ Created test model');
  } else {
    console.log('✓ Test model already exists');
  }

  // 2. Create test version (draft, with blocking validation)
  const versionId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const { data: existingVersion } = await supabase
    .from('model_versions')
    .select('id')
    .eq('id', versionId)
    .single();

  if (!existingVersion) {
    const { error: versionError } = await supabase
      .from('model_versions')
      .insert({
        id: versionId,
        model_id: modelId,
        name: 'E2E Test Version',
        status: 'Draft', // Blueprint: capitalized status
        created_by: null,
      });

    if (versionError) {
      console.error('Failed to create version:', versionError);
      process.exit(1);
    }
    console.log('✓ Created test version');
  } else {
    console.log('✓ Test version already exists');
  }

  // 3. Add tabs (but missing required ones to create validation errors)
  const tabs = [
    { tab: 'overview', data: { summary: 'Test overview' } },
    // Intentionally missing 'pnl', 'bs', 'cf' to create validation errors
    { tab: 'capex', data: { projects: [] } },
  ];

  // Delete existing tabs
  await supabase.from('version_tabs').delete().eq('version_id', versionId);

  // Insert tabs
  const tabsToInsert = tabs.map((t) => ({
    version_id: versionId,
    tab: t.tab,
    data: t.data,
  }));

  const { error: tabsError } = await supabase
    .from('version_tabs')
    .insert(tabsToInsert);

  if (tabsError) {
    console.error('Failed to create tabs:', tabsError);
    process.exit(1);
  }
  console.log('✓ Created tabs (missing required ones for validation errors)');

  // 4. Create blocking validation error
  await supabase.from('version_validations').delete().eq('version_id', versionId);

  const { error: validationError } = await supabase
    .from('version_validations')
    .insert({
      version_id: versionId,
      code: 'NO_PNL',
      message: 'PNL tab is missing',
      severity: 'error',
    });

  if (validationError) {
    console.error('Failed to create validation:', validationError);
    process.exit(1);
  }
  console.log('✓ Created blocking validation error');

  // 5. Create version for cloning (with all required tabs)
  const cloneVersionId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const { data: existingCloneVersion } = await supabase
    .from('model_versions')
    .select('id')
    .eq('id', cloneVersionId)
    .single();

  if (!existingCloneVersion) {
    const { error: cloneVersionError } = await supabase
      .from('model_versions')
      .insert({
        id: cloneVersionId,
        model_id: modelId,
        name: 'E2E Clone Source',
        status: 'Ready', // Blueprint: capitalized status
        created_by: null,
      });

    if (cloneVersionError) {
      console.error('Failed to create clone source version:', cloneVersionError);
      process.exit(1);
    }
    console.log('✓ Created clone source version');
  }

  // Add all required tabs for clone source
  const cloneTabs = [
    { tab: 'overview', data: { summary: 'Clone source overview' } },
    { tab: 'pnl', data: { revenue: 100000, ebit: 20000 } },
    { tab: 'bs', data: { assets: 500000, equity: 300000, liabilities: 200000 } },
    { tab: 'cf', data: { operating: 15000 } },
  ];

  await supabase.from('version_tabs').delete().eq('version_id', cloneVersionId);

  const cloneTabsToInsert = cloneTabs.map((t) => ({
    version_id: cloneVersionId,
    tab: t.tab,
    data: t.data,
  }));

  const { error: cloneTabsError } = await supabase
    .from('version_tabs')
    .insert(cloneTabsToInsert);

  if (cloneTabsError) {
    console.error('Failed to create clone tabs:', cloneTabsError);
    process.exit(1);
  }
  console.log('✓ Created clone source tabs');

  console.log('\n✅ Test data seeded successfully!');
  console.log('\nTest IDs:');
  console.log(`  Model ID: ${modelId}`);
  console.log(`  Version ID (with validation errors): ${versionId}`);
  console.log(`  Clone Source ID: ${cloneVersionId}`);
  console.log('\nYou can now run e2e tests with these IDs.');
}

seedTestData().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

