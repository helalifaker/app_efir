import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { withErrorHandler } from '@/lib/withErrorHandler';

type VersionRow = {
  id: string;
  name: string;
  status: string;
  model_id: string;
  models: { name: string }[] | null;
};

type FormattedVersion = {
  id: string;
  name: string;
  status: string;
  model_name: string;
  model_id: string;
};

export const GET = withErrorHandler(async () => {
  const supabase = getServiceClient();

  const { data: versions, error } = await supabase
    .from('model_versions')
    .select('id, name, status, model_id, models(name)')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch versions for compare', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const formattedVersions: FormattedVersion[] = (versions || []).map((v) => {
    const row = v as unknown as VersionRow;
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      model_name: row.models?.[0]?.name || 'Unknown Model',
      model_id: row.model_id,
    };
  });

  return NextResponse.json({ versions: formattedVersions });
});

