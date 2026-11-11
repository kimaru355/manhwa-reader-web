import { createHash } from 'node:crypto';
import fallback from '@/data/recommendations.fallback.json';
import { buildExport } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CACHE = 'public, s-maxage=300, stale-while-revalidate=86400';

/**
 * Served to the mobile app. Built from the database; if the database is unreachable
 * (or not configured) it serves the last committed snapshot so the app never breaks.
 */
export async function GET(req: Request) {
  let data: unknown;
  try {
    data = await buildExport();
  } catch (e) {
    console.error('recommendations: database unavailable, serving snapshot', (e as Error)?.message);
    data = fallback;
  }
  const text = JSON.stringify(data);
  const etag = `"${createHash('sha1').update(text).digest('base64url')}"`;
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': CACHE, ETag: etag };
  if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  return new Response(text, { headers });
}
