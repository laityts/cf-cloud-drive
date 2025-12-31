import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { files } from '@/db/schema';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { key, filename, size, type, parentId } = await req.json();

    if (!key || !filename || size === undefined || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { env } = getRequestContext();
    
    if (!env.DB) {
      console.error('DB binding not found');
      return NextResponse.json({ error: 'Database configuration error' }, { status: 500 });
    }

    const db = getDb(env.DB);

    // Insert file metadata into D1
    const result = await db.insert(files).values({
      id: crypto.randomUUID(),
      name: filename,
      size: size,
      type: 'file',
      mimeType: type,
      parentId: parentId || null,
      r2Key: key,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return NextResponse.json(result[0] || { success: true });

  } catch (error) {
    console.error('Upload complete error:', error);
    // Return the actual error message for debugging
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
