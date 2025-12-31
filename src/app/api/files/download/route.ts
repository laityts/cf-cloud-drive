import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { files } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
    const { fileId } = await req.json();

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    const { env } = getRequestContext();
    const db = getDb(env.DB);

    // Get file info from D1
    const fileRecord = await db.select().from(files).where(eq(files.id, fileId)).get();

    if (!fileRecord) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (fileRecord.type === 'folder') {
      return NextResponse.json({ error: 'Cannot download a folder' }, { status: 400 });
    }

    if (!fileRecord.r2Key) {
      return NextResponse.json({ error: 'File key missing' }, { status: 500 });
    }

    // Generate Presigned URL
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

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileRecord.r2Key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileRecord.name)}"`,
    });

    const url = await getSignedUrl(S3, command, { expiresIn: 3600 }); // 1 hour

    return NextResponse.json({ url });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
