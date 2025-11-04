// scripts/test-helpers.ts
// Helper functions for e2e tests to manipulate test data

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error('Missing SUPABASE environment variables');
}

const supabase = createClient(supabaseUrl, serviceKey);

/**
 * Remove all validation errors for a version
 */
export async function removeValidations(versionId: string) {
  const { error } = await supabase
    .from('version_validations')
    .delete()
    .eq('version_id', versionId)
    .eq('severity', 'error');

  if (error) {
    throw new Error(`Failed to remove validations: ${error.message}`);
  }
}

/**
 * Add a tab to a version
 */
export async function addTab(
  versionId: string,
  tab: string,
  data: Record<string, unknown>
) {
  const { error } = await supabase
    .from('version_tabs')
    .upsert(
      {
        version_id: versionId,
        tab,
        data,
      },
      { onConflict: 'version_id,tab' }
    );

  if (error) {
    throw new Error(`Failed to add tab: ${error.message}`);
  }
}

/**
 * Set version status
 * Blueprint: Status values are capitalized (Draft, Ready, Locked, Archived)
 */
export async function setVersionStatus(
  versionId: string,
  status: 'Draft' | 'Ready' | 'Locked' | 'Archived'
) {
  const { error } = await supabase
    .from('model_versions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', versionId);

  if (error) {
    throw new Error(`Failed to set status: ${error.message}`);
  }
}

