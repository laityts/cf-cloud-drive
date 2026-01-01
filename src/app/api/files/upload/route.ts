import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import { AwsClient } from 'aws4fetch';

export async function POST(req: NextRequest) {
  try {
    const { filename, contentType } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'Filename and Content-Type are required' }, { status: 400 });
    }

    const { env } = getCloudflareContext();
    const accountId = env.R2_ACCOUNT_ID;
    const accessKeyId = env.R2_ACCESS_KEY_ID;
    const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
    const bucketName = env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      console.error('Missing R2 configuration');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const r2 = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: 's3',
      region: 'auto',
    });

    // Generate a unique key for R2 (UUID)
    const ext = filename.split('.').pop();
    const key = `${crypto.randomUUID()}.${ext}`;

    const url = new URL(`https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`);
    url.searchParams.set('X-Amz-Expires', '600'); // 10 minutes

    const signed = await r2.sign(new Request(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
    }), {
      aws: { signQuery: true },
    });

    return NextResponse.json({ 
      url: signed.url, 
      key, 
      filename 
    });

  } catch (error) {
    console.error('Upload init error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
