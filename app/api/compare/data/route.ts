import { NextResponse } from 'next/server';
import { getCompareData } from '@/lib/getCompareData';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    const baselineParam = searchParams.get('baseline');

    if (!idsParam || !baselineParam) {
      return NextResponse.json(
        { error: 'Missing ids or baseline parameter' },
        { status: 400 }
      );
    }

    const ids = idsParam.split(',').filter(Boolean);
    
    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'No version IDs provided' },
        { status: 400 }
      );
    }

    if (!ids.includes(baselineParam)) {
      return NextResponse.json(
        { error: 'Baseline must be one of the provided IDs' },
        { status: 400 }
      );
    }

    const compareData = await getCompareData(ids, baselineParam);
    
    return NextResponse.json(compareData);
  } catch (e: any) {
    console.error('Compare data route error:', e);
    return NextResponse.json(
      { error: e?.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}

