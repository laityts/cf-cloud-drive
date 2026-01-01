import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { files } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs array is required' }, { status: 400 });
    }

    const { env } = getCloudflareContext();
    const db = getDb(env.DB);

    // Fetch files to be deleted
    const filesToDelete = await db.select().from(files).where(inArray(files.id, ids)).all();

    if (filesToDelete.length === 0) {
      return NextResponse.json({ success: true, deletedCount: 0 });
    }

    // Check for non-empty folders
    for (const file of filesToDelete) {
      if (file.type === 'folder') {
        const children = await db.select().from(files).where(eq(files.parentId, file.id)).limit(1).get();
        if (children) {
          return NextResponse.json({ error: `Folder "${file.name}" is not empty` }, { status: 400 });
        }
      }
    }

    // Delete from R2 (only files)
    // Use Cloudflare Workers R2 binding directly instead of S3 SDK
    const deletePromises = filesToDelete
      .filter(f => f.type === 'file' && f.r2Key)
      .map(f => env.R2.delete(f.r2Key!));

    await Promise.all(deletePromises);

    // Delete from D1
    await db.delete(files).where(inArray(files.id, ids));

    return NextResponse.json({ success: true, deletedCount: filesToDelete.length });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
