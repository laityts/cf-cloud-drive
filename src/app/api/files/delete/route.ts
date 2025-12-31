import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { files } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  // Polyfill DOMParser and Node for AWS SDK in Edge Runtime
  if (!(globalThis as any).DOMParser) {
    (globalThis as any).DOMParser = DOMParser;
  }
  if (!(globalThis as any).XMLSerializer) {
    (globalThis as any).XMLSerializer = XMLSerializer;
  }
  if (!(globalThis as any).Node) {
    (globalThis as any).Node = {
      ELEMENT_NODE: 1,
      ATTRIBUTE_NODE: 2,
      TEXT_NODE: 3,
      CDATA_SECTION_NODE: 4,
      ENTITY_REFERENCE_NODE: 5,
      ENTITY_NODE: 6,
      PROCESSING_INSTRUCTION_NODE: 7,
      COMMENT_NODE: 8,
      DOCUMENT_NODE: 9,
      DOCUMENT_TYPE_NODE: 10,
      DOCUMENT_FRAGMENT_NODE: 11,
      NOTATION_NODE: 12
    };
  }

  try {
    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs array is required' }, { status: 400 });
    }

    const { env } = getRequestContext();
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

    // Initialize S3 Client
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return NextResponse.json({ error: 'R2 configuration missing' }, { status: 500 });
    }

    const S3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Delete from R2 (only files)
    const deletePromises = filesToDelete
      .filter(f => f.type === 'file' && f.r2Key)
      .map(f => S3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: f.r2Key! })));

    await Promise.all(deletePromises);

    // Delete from D1
    await db.delete(files).where(inArray(files.id, ids));

    return NextResponse.json({ success: true, deletedCount: filesToDelete.length });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
