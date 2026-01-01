import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { files } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  // Polyfill DOMParser and Node for AWS SDK in Edge Runtime
  /* eslint-disable @typescript-eslint/no-explicit-any */
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
  /* eslint-enable @typescript-eslint/no-explicit-any */

  try {
    const { fileId } = await params;

    if (!fileId) {
      return new NextResponse('File ID is required', { status: 400 });
    }

    const { env } = getCloudflareContext();
    const db = getDb(env.DB);

    // Get file info from D1
    const fileRecord = await db.select().from(files).where(eq(files.id, fileId)).get();

    if (!fileRecord) {
      return new NextResponse('File not found', { status: 404 });
    }

    if (!fileRecord.r2Key) {
      return new NextResponse('File content missing', { status: 500 });
    }

    // Initialize S3 Client using env vars from Cloudflare Context
    const accountId = env.R2_ACCOUNT_ID;
    const accessKeyId = env.R2_ACCESS_KEY_ID;
    const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
    const bucketName = env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return new NextResponse('Server configuration error: Missing R2 credentials', { status: 500 });
    }

    const S3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Fetch from R2
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileRecord.r2Key,
    });

    try {
      const response = await S3.send(command);
      
      if (!response.Body) {
        return new NextResponse('Empty file', { status: 404 });
      }

      // Convert the stream to a Web ReadableStream
      const stream = response.Body.transformToWebStream();

      return new NextResponse(stream, {
        headers: {
          'Content-Type': fileRecord.mimeType || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
          'Content-Disposition': `inline; filename="${encodeURIComponent(fileRecord.name)}"`,
        },
      });
    } catch (s3Error) {
      console.error('S3 Fetch Error:', s3Error);
      return new NextResponse('File not found in storage', { status: 404 });
    }

  } catch (error) {
    console.error('Raw file error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
