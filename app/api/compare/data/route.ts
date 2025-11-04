import { NextResponse } from 'next/server';
import { getCompareData } from '@/lib/getCompareData';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('ids');
  const baselineParam = searchParams.get('baseline');

  try {
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
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    logger.error('Compare data route error', error, { idsParam, baselineParam });
    return NextResponse.json(
      { error: error.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}

