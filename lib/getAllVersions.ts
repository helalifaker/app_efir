// lib/getAllVersions.ts
import { getServiceClient } from './supabaseServer';

export type VersionOption = {
  id: string;
  name: string;
  status: string;
  model_name: string;
  model_id: string;
};

/**
 * Fetch all versions with their model names for dropdowns
 */
export async function getAllVersions(): Promise<VersionOption[]> {
  const supabase = getServiceClient();

  const { data: versions, error } = await supabase
    .from('model_versions')
    .select('id, name, status, model_id, models(name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('All versions query error:', error);
    throw error;
  }

  return (versions || []).map((v: any) => ({
    id: v.id,
    name: v.name,
    status: v.status,
    model_name: v.models?.name || 'Unknown Model',
    model_id: v.model_id,
  }));
}

