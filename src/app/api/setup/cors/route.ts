import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  // Polyfill DOMParser and Node for AWS SDK in Edge Runtime
  // We do this inside the handler to avoid side effects on module load
  if (!(globalThis as any).DOMParser) {
    (globalThis as any).DOMParser = DOMParser;
  }
  if (!(globalThis as any).XMLSerializer) {
    (globalThis as any).XMLSerializer = XMLSerializer;
  }

  // Polyfill Node constants if they don't exist
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
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return NextResponse.json({ error: 'Missing R2 configuration' }, { status: 500 });
    }

    const S3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const command = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['PUT', 'POST', 'GET', 'HEAD'],
            AllowedOrigins: ['*'], // Allow all origins for development convenience
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    });

    await S3.send(command);

    return NextResponse.json({ success: true, message: 'CORS configured successfully for bucket: ' + bucketName });

  } catch (error) {
    console.error('CORS setup error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
