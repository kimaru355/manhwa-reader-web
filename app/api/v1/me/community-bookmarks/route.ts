import { requireUser } from '@/lib/api/auth';
import { json, route } from '@/lib/api/http';
import { db, ensureSchema } from '@/lib/db';

type Row = {
  id: string;
  source: string;
  series_id: string;
  series_title: string;
  chapter_id: string;
  chapter_name: string;
  page: number;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason: string | null;
  created_at: string | Date;
};

/** The signed-in user's own suggestions with their review status. */
export const GET = route(async ({ req, rate }) => {
  const user = await requireUser(req);
  await rate('read', user.id);
  await ensureSchema();
  const rows = (await db().query('select * from community_bookmarks where user_id = $1 order by created_at desc', [user.id])) as Row[];
  return json(
    {
      items: rows.map((r) => ({
        id: r.id,
        source: r.source,
        seriesId: r.series_id,
        seriesTitle: r.series_title,
        chapterId: r.chapter_id,
        chapterName: r.chapter_name,
        page: r.page,
        note: r.note,
        status: r.status,
        rejectReason: r.reject_reason,
        createdAt: new Date(r.created_at).toISOString(),
      })),
    },
    200,
    { 'Cache-Control': 'private, no-store' },
  );
});
