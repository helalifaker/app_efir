// lib/getCompareData.ts
import { unstable_cache } from 'next/cache';
import { revalidateTag } from 'next/cache';
import { getServiceClient } from './supabaseServer';
import { logger } from './logger';

export type CompareVersion = {
  id: string;
  name: string;
  status: string;
  model_name: string;
};

export type VersionTabData = {
  pnl: Record<string, unknown>;
  bs: Record<string, unknown>;
  cf: Record<string, unknown>;
};

export type CompareData = {
  versions: CompareVersion[];
  baselineId: string;
  tabsByVersion: Record<string, VersionTabData>;
  allKeys: {
    pnl: string[];
    bs: string[];
    cf: string[];
  };
};

// Internal function without caching
async function _getCompareData(
  versionIds: string[],
  baselineId: string
): Promise<CompareData> {
  const supabase = getServiceClient();

  if (versionIds.length === 0) {
    throw new Error('At least one version ID is required');
  }

  if (!baselineId || !versionIds.includes(baselineId)) {
    throw new Error('Baseline ID must be included in version IDs');
  }

  // Fetch all versions with their model names
  const { data: versions, error: vErr } = await supabase
    .from('model_versions')
    .select('id, name, status, model_id, models(name)')
    .in('id', versionIds);

  if (vErr) {
    logger.error('Compare versions query error', vErr, { versionIds, operation: 'get_compare_data' });
    throw vErr;
  }

  if (!versions || versions.length === 0) {
    throw new Error('No versions found for the provided IDs');
  }

  // Format versions
  const formattedVersions: CompareVersion[] = versions.map((v: any) => ({
    id: v.id,
    name: v.name,
    status: v.status,
    model_name: v.models?.[0]?.name || (Array.isArray(v.models) ? v.models[0]?.name : v.models?.name) || 'Unknown Model',
  }));

  // Fetch tabs for all versions (pnl, bs, cf only)
  const { data: tabs, error: tErr } = await supabase
    .from('version_tabs')
    .select('version_id, tab, data')
    .in('version_id', versionIds)
    .in('tab', ['pnl', 'bs', 'cf']);

  if (tErr) {
    logger.error('Compare tabs query error', tErr, { versionIds, operation: 'get_compare_data' });
    throw tErr;
  }

  // Organize tabs by version_id
  const tabsByVersion: Record<string, VersionTabData> = {};
  versionIds.forEach((vid) => {
    tabsByVersion[vid] = { pnl: {}, bs: {}, cf: {} };
  });

  (tabs || []).forEach((tab: { version_id: string; tab: string; data: Record<string, unknown> | null }) => {
    if (tabsByVersion[tab.version_id]) {
      tabsByVersion[tab.version_id][tab.tab as keyof VersionTabData] = tab.data || {};
    }
  });

  // Collect all metric keys across all versions for each tab
  const allKeys = { pnl: new Set<string>(), bs: new Set<string>(), cf: new Set<string>() };

  Object.values(tabsByVersion).forEach((versionTabs) => {
    (['pnl', 'bs', 'cf'] as const).forEach((tabKey) => {
      const data = versionTabs[tabKey];
      if (data && typeof data === 'object') {
        Object.keys(data).forEach((key) => {
          // Only include keys with numeric values
          const value = data[key];
          if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)))) {
            allKeys[tabKey].add(key);
          }
        });
      }
    });
  });

  return {
    versions: formattedVersions,
    baselineId,
    tabsByVersion,
    allKeys: {
      pnl: Array.from(allKeys.pnl).sort(),
      bs: Array.from(allKeys.bs).sort(),
      cf: Array.from(allKeys.cf).sort(),
    },
  };
}

// Cached version with revalidation tags
// Note: unstable_cache requires a function that takes primitive arguments
// We'll create a cache key from the versionIds array
export function getCompareData(
  versionIds: string[],
  baselineId: string
): Promise<CompareData> {
  // Sort versionIds for consistent cache key
  const sortedIds = [...versionIds].sort().join(',');
  const cacheKey = `compare-${sortedIds}-${baselineId}`;
  
  return unstable_cache(
    () => _getCompareData(versionIds, baselineId),
    [cacheKey],
    {
      tags: ['compare', 'versions', 'version-tabs'],
      revalidate: 60, // Revalidate every 60 seconds
    }
  )();
}

// Export revalidation helper
export function revalidateCompare() {
  revalidateTag('compare', {});
  revalidateTag('versions', {});
  revalidateTag('version-tabs', {});
}
