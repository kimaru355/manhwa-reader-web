import fallback from '@/data/recommendations.fallback.json';
import { buildExport } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Served to the mobile app. Built from the database; if the database is unreachable
 * (or not configured) it serves the last committed snapshot so the app never breaks.
 */
export async function GET() {
  try {
    return Response.json(await buildExport(), {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' },
    });
  } catch (e) {
    console.error('recommendations: database unavailable, serving snapshot', e);
    return Response.json(fallback, { headers: { 'Cache-Control': 'public, s-maxage=30' } });
  }
}
