import { NextResponse } from 'next/server';
import { runEngine } from '@/lib/engine';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set.' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await runEngine();
  return NextResponse.json(result);
}

// Vercel Cron sends GET with the CRON_SECRET bearer token.
export const GET = handle;
export const POST = handle;
