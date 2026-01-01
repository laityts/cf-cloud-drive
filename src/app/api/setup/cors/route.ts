import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import { AwsClient } from 'aws4fetch';

export async function GET() {
  try {
    const { env } = getCloudflareContext();
    const accountId = env.R2_ACCOUNT_ID;
    const accessKeyId = env.R2_ACCESS_KEY_ID;
    const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
    const bucketName = env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return NextResponse.json({ error: 'Missing R2 configuration' }, { status: 500 });
    }

    const r2 = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: 's3',
      region: 'auto',
    });

    const corsConfig = `
      <CORSConfiguration>
        <CORSRule>
          <AllowedOrigin>*</AllowedOrigin>
          <AllowedMethod>PUT</AllowedMethod>
          <AllowedMethod>POST</AllowedMethod>
          <AllowedMethod>GET</AllowedMethod>
          <AllowedMethod>HEAD</AllowedMethod>
          <AllowedHeader>*</AllowedHeader>
          <ExposeHeader>ETag</ExposeHeader>
          <MaxAgeSeconds>3000</MaxAgeSeconds>
        </CORSRule>
      </CORSConfiguration>
    `.trim();

    const url = `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/?cors`;
    
    const response = await r2.fetch(url, {
      method: 'PUT',
      body: corsConfig,
      headers: {
        'Content-Type': 'application/xml',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to set CORS: ${response.status} ${errorText}`);
    }

    return NextResponse.json({ success: true, message: 'CORS configured successfully for bucket: ' + bucketName });

  } catch (error) {
    console.error('CORS setup error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
