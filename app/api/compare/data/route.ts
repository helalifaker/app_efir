import { NextResponse } from 'next/server';
import { getCompareData } from '@/lib/getCompareData';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';

export const GET = withErrorHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('ids');
  const baselineParam = searchParams.get('baseline');

  if (!idsParam || !baselineParam) {
    return createErrorResponse('Missing ids or baseline parameter', 400);
  }

  const ids = idsParam.split(',').filter(Boolean);
  
  if (ids.length === 0) {
    return createErrorResponse('No version IDs provided', 400);
  }

  if (!ids.includes(baselineParam)) {
    return createErrorResponse('Baseline must be one of the provided IDs', 400);
  }

  const compareData = await getCompareData(ids, baselineParam);
  
  return NextResponse.json(compareData);
});

