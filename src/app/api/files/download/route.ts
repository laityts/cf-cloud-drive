import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { files } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AwsClient } from 'aws4fetch';

export async function POST(req: NextRequest) {
  try {
    const { fileId } = await req.json();

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    const { env } = getCloudflareContext();
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
    const accountId = env.R2_ACCOUNT_ID;
    const accessKeyId = env.R2_ACCESS_KEY_ID;
    const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
    const bucketName = env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return NextResponse.json({ error: 'R2 configuration missing' }, { status: 500 });
    }

    const r2 = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: 's3',
      region: 'auto',
    });

    const url = new URL(`https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${fileRecord.r2Key}`);
    url.searchParams.set('X-Amz-Expires', '3600'); // 1 hour
    url.searchParams.set('response-content-disposition', `attachment; filename="${encodeURIComponent(fileRecord.name)}"`);

    const signed = await r2.sign(new Request(url, {
      method: 'GET',
    }), {
      aws: { signQuery: true },
    });

    return NextResponse.json({ url: signed.url });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
