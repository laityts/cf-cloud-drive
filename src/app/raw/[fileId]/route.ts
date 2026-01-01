import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { files } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AwsClient } from 'aws4fetch';

export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
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

    const r2 = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: 's3',
      region: 'auto',
    });

    // Fetch from R2
    const url = `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${fileRecord.r2Key}`;
    
    try {
      const response = await r2.fetch(url);
      
      if (!response.ok) {
         if (response.status === 404) {
             return new NextResponse('File not found in storage', { status: 404 });
         }
         throw new Error(`R2 fetch failed: ${response.status} ${response.statusText}`);
      }

      return new NextResponse(response.body, {
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
