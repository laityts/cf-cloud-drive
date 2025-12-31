import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { systemSettings } from '@/db/schema';
import { hashPassword } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const { env } = getRequestContext();
    const db = getDb(env.DB);

    // Check if password already exists
    const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, 'admin_password_hash')).get();
    
    if (existing) {
      return NextResponse.json({ error: 'System already setup' }, { status: 403 });
    }

    const hashedPassword = await hashPassword(password);

    await db.insert(systemSettings).values({
      key: 'admin_password_hash',
      value: hashedPassword,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
