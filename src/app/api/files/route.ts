import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { files } from '@/db/schema';
import { eq, isNull, desc, asc, sql, like, and } from 'drizzle-orm';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get('parentId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const { env } = getRequestContext();
    const db = getDb(env.DB);

    let whereClause;
    if (search) {
      // If searching, ignore parentId and search globally by name
      whereClause = like(files.name, `%${search}%`);
    } else {
      // Otherwise, filter by parentId (folder navigation)
      whereClause = parentId ? eq(files.parentId, parentId) : isNull(files.parentId);
    }

    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(files)
      .where(whereClause)
      .get();
    
    const total = countResult?.count || 0;

    // Get paginated data
    // Sort: Folders first (type desc: 'folder' > 'file'), then name asc
    const result = await db.select()
      .from(files)
      .where(whereClause)
      .orderBy(desc(files.type), asc(files.name))
      .limit(limit)
      .offset(offset)
      .all();

    return NextResponse.json({
      data: result,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('List files error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
