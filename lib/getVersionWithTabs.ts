// lib/getVersionWithTabs.ts
import { unstable_cache } from 'next/cache';
import { revalidateTag } from 'next/cache';
import { getServiceClient } from './supabaseServer';
import { resolveUsers } from './resolveUser';

// Internal function without caching (for mutations to call)
async function _getVersionWithTabs(versionId: string) {
  const supabase = getServiceClient();

  //
  // 1) get the version (we know this id exists!)
  //
  const { data: version, error: vErr } = await supabase
    .from('model_versions')
    .select('*')
    .eq('id', versionId)
    .maybeSingle();

  if (vErr) {
    console.error('VERSION QUERY ERROR', vErr);
    throw vErr;
  }

  if (!version) {
    throw new Error('Version not found for id: ' + versionId);
  }

  //
  // 2) get the parent model (using version.model_id)
  //
  const { data: model, error: mErr } = await supabase
    .from('models')
    .select('id, name, description')
    .eq('id', version.model_id)
    .maybeSingle();

  if (mErr) {
    console.error('MODEL QUERY ERROR', mErr);
    throw mErr;
  }

  //
  // 3) get the tabs
  //
  const { data: tabs, error: tErr } = await supabase
    .from('version_tabs')
    .select('id, version_id, tab, data, updated_at')
    .eq('version_id', versionId)
    .order('tab');

  if (tErr) {
    console.error('TABS QUERY ERROR', tErr);
    throw tErr;
  }

  //
  // 4) get the validations
  //
  const { data: validations, error: valErr } = await supabase
    .from('version_validations')
    .select('id, code, message, severity, created_at')
    .eq('version_id', versionId)
    .order('created_at', { ascending: false });

  if (valErr) {
    console.error('VALIDATIONS QUERY ERROR', valErr);
    throw valErr;
  }

  //
  // 5) get the status history (first 50 only for performance)
  //
  const { data: history, error: histErr } = await supabase
    .from('version_status_history')
    .select('id, old_status, new_status, changed_by, note, changed_at')
    .eq('version_id', versionId)
    .order('changed_at', { ascending: false })
    .limit(50);

  if (histErr) {
    console.error('HISTORY QUERY ERROR', histErr);
    throw histErr;
  }

  // Resolve user IDs to emails/names
  const userIds = (history || []).map((h: any) => h.changed_by).filter(Boolean);
  const userMap = await resolveUsers(userIds);
  
  // Add resolved names to history items
  const enrichedHistory = (history || []).map((h: any) => ({
    ...h,
    changed_by_name: h.changed_by ? (userMap[h.changed_by] || 'System') : 'System',
  }));

  // turn tabs[] → { overview: {...}, pnl: {...}, ... }
  const tabByKey: Record<string, any> = {};
  (tabs || []).forEach((t) => {
    tabByKey[t.tab] = t;
  });

  return {
    version: {
      ...version,
      model, // so the page can do version.model?.name
    },
    tabs: tabByKey,
    validations: validations || [],
    history: enrichedHistory || [],
  };
}

// Cached version with revalidation tags
export function getVersionWithTabs(versionId: string) {
  return unstable_cache(
    () => _getVersionWithTabs(versionId),
    [`version-with-tabs-${versionId}`],
    {
      tags: ['versions', 'version-tabs', 'version-validations', 'version-history', `version-${versionId}`],
      revalidate: 60, // Revalidate every 60 seconds
    }
  )();
}

// Export revalidation helper
export async function revalidateVersion(versionId: string) {
  revalidateTag('versions', {});
  revalidateTag('version-tabs', {});
  revalidateTag('version-validations', {});
  revalidateTag('version-history', {});
  revalidateTag(`version-${versionId}`, {});
}
