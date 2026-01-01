import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';



export async function GET(req: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const db = getDb(env.DB);

    const record = await db.select().from(systemSettings).where(eq(systemSettings.key, 'admin_password_hash')).get();

    return NextResponse.json({ isSetup: !!record });
  } catch (error) {
    console.error('Status error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
