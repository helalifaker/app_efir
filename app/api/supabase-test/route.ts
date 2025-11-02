import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient(); // await here ✅

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    return NextResponse.json({
      ok: !error,
      stage: 'auth.getUser',
      env: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'missing',
        anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'set' : 'missing',
      },
      user: user ?? null,
      error: error?.message ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        stage: 'exception',
        error: e.message || 'unexpected error',
      },
      { status: 500 }
    );
  }
}
