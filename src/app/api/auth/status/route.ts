import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = getDb(env.DB);

    const record = await db.select().from(systemSettings).where(eq(systemSettings.key, 'admin_password_hash')).get();

    return NextResponse.json({ isSetup: !!record });
  } catch (error) {
    console.error('Status error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
