import { NextResponse } from 'next/server';
import { liveLaunches, publicLaunch } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const launches = (await liveLaunches(200)).map(publicLaunch);
  return NextResponse.json({ launches });
}
