// lib/getVersionWithTabs.ts
import { unstable_cache } from 'next/cache';
import { revalidateTag } from 'next/cache';
import { getServiceClient } from './supabaseServer';
import { resolveUsers } from './resolveUser';
import { logger } from './logger';

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
    logger.error('Version query error', vErr, { versionId, operation: 'get_version_with_tabs' });
    throw vErr;
  }

  if (!version) {
    throw new Error('Version not found for id: ' + versionId);
  }

  //
  // 2-5) Run all independent queries in parallel for better performance
  //
  const [modelResult, tabsResult, validationsResult, historyResult] = await Promise.all([
    // 2) get the parent model
    supabase
      .from('models')
      .select('id, name, description')
      .eq('id', version.model_id)
      .maybeSingle(),
    
    // 3) get the tabs
    supabase
      .from('version_tabs')
      .select('id, version_id, tab, data, updated_at')
      .eq('version_id', versionId)
      .order('tab'),
    
    // 4) get the validations
    supabase
      .from('version_validations')
      .select('id, code, message, severity, created_at')
      .eq('version_id', versionId)
      .order('created_at', { ascending: false }),
    
    // 5) get the status history (first 50 only for performance)
    supabase
      .from('version_status_history')
      .select('id, old_status, new_status, changed_by, note, changed_at')
      .eq('version_id', versionId)
      .order('changed_at', { ascending: false })
      .limit(50),
  ]);

  // Check for errors
  if (modelResult.error) {
    logger.error('Model query error', modelResult.error, { modelId: version.model_id, versionId, operation: 'get_version_with_tabs' });
    throw modelResult.error;
  }

  if (tabsResult.error) {
    logger.error('Tabs query error', tabsResult.error, { versionId, operation: 'get_version_with_tabs' });
    throw tabsResult.error;
  }

  if (validationsResult.error) {
    logger.error('Validations query error', validationsResult.error, { versionId, operation: 'get_version_with_tabs' });
    throw validationsResult.error;
  }

  if (historyResult.error) {
    logger.error('History query error', historyResult.error, { versionId, operation: 'get_version_with_tabs' });
    throw historyResult.error;
  }

  const model = modelResult.data;
  const tabs = tabsResult.data || [];
  const validations = validationsResult.data || [];
  const history = historyResult.data || [];

  // Resolve user IDs to emails/names
  type HistoryItem = {
    id: string;
    old_status: string;
    new_status: string;
    changed_by: string | null;
    note: string | null;
    changed_at: string;
  };
  
  const userIds = history.map((h: HistoryItem) => h.changed_by).filter(Boolean) as string[];
  const userMap = await resolveUsers(userIds);
  
  // Add resolved names to history items
  const enrichedHistory = history.map((h: HistoryItem) => ({
    ...h,
    changed_by_name: h.changed_by ? (userMap[h.changed_by] || 'System') : 'System',
  }));

  // turn tabs[] → { overview: {...}, pnl: {...}, ... }
  type TabItem = {
    id: string;
    version_id: string;
    tab: string;
    data: unknown;
    updated_at: string;
  };
  
  const tabByKey: Record<string, TabItem> = {};
  tabs.forEach((t: TabItem) => {
    tabByKey[t.tab] = t;
  });

  return {
    version: {
      ...version,
      model, // so the page can do version.model?.name
    },
    tabs: tabByKey,
    validations,
    history: enrichedHistory,
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
