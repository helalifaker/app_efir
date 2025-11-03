import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const supabase = getServiceClient();

    const { data: versions, error } = await supabase
      .from('model_versions')
      .select('id, name, status, model_id, models(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('All versions query error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const formattedVersions = (versions || []).map((v: any) => ({
      id: v.id,
      name: v.name,
      status: v.status,
      model_name: v.models?.name || 'Unknown Model',
      model_id: v.model_id,
    }));

    return NextResponse.json({ versions: formattedVersions });
  } catch (e: any) {
    console.error('Versions route error:', e);
    return NextResponse.json(
      { error: e?.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}

