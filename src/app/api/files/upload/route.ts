import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export async function POST(req: NextRequest) {
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
    const { filename, contentType } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'Filename and Content-Type are required' }, { status: 400 });
    }

    // We need to access environment variables. 
    // In Cloudflare Pages, process.env works for vars defined in dashboard or .dev.vars
    // BUT for AWS SDK to work properly in Edge Runtime, we need to pass credentials explicitly.
    
    const { env } = getCloudflareContext();
    const accountId = env.R2_ACCOUNT_ID;
    const accessKeyId = env.R2_ACCESS_KEY_ID;
    const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
    const bucketName = env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      console.error('Missing R2 configuration');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const S3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Generate a unique key for R2 (UUID)
    // We keep the extension to be safe, though R2 doesn't care.
    const ext = filename.split('.').pop();
    const key = `${crypto.randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });

    // Generate presigned URL valid for 10 minutes (600 seconds)
    const url = await getSignedUrl(S3, command, { expiresIn: 600 });

    return NextResponse.json({ 
      url, 
      key, // Frontend needs this key to call the complete API
      filename // Echo back
    });

  } catch (error) {
    console.error('Upload init error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
