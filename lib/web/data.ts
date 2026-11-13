import fallback from '@/data/recommendations.fallback.json';
import { buildExport, db, ensureSchema } from '@/lib/db';
import type { Category, SourceId } from '@/lib/shared';

export type Mark = { chapterId: string; chapterName?: string; page?: number; note?: string };

export type PublicRec = {
  source: SourceId;
  id: string;
  title: string;
  cover?: string;
  url?: string;
  category: Category;
  tier: string;
  note?: string;
  bookmarks?: Mark[];
};

/** The author's picks. Falls back to the committed snapshot if the database is unreachable. */
export async function getRecs(): Promise<PublicRec[]> {
  try {
    return (await buildExport()).recommendations as PublicRec[];
  } catch {
    return (fallback as { recommendations: PublicRec[] }).recommendations;
  }
}

export async function authorMarks(source: string, id: string): Promise<Mark[]> {
  const recs = await getRecs();
  return recs.find((r) => r.source === source && r.id === id)?.bookmarks ?? [];
}

export async function communityMarks(source: string, id: string): Promise<(Mark & { id: string })[]> {
  try {
    await ensureSchema();
    const rows = (await db().query(
      `select id, chapter_id, chapter_name, page, note from community_bookmarks
       where status = 'approved' and source = $1 and series_id = $2 order by created_at`,
      [source, id],
    )) as { id: string; chapter_id: string; chapter_name: string; page: number; note: string | null }[];
    return rows.map((r) => ({ id: r.id, chapterId: r.chapter_id, chapterName: r.chapter_name, page: r.page, note: r.note ?? undefined }));
  } catch {
    return [];
  }
}

export { imgUrl, seriesHref } from './links';
