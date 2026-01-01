import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { files } from '@/db/schema';



export async function POST(req: NextRequest) {
  try {
    const { name, parentId } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    const { env } = getCloudflareContext();
    const db = getDb(env.DB);

    const newFolder = {
      id: crypto.randomUUID(), // Use Web Crypto API for UUID in Edge
      parentId: parentId || null,
      name,
      type: 'folder' as const,
      size: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(files).values(newFolder);

    return NextResponse.json(newFolder);
  } catch (error) {
    console.error('Create folder error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
