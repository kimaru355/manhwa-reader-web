import { db, ensureSchema } from '@/lib/db';

export type BookmarkStatus = 'pending' | 'approved' | 'rejected';

export type BookmarkRequest = {
  id: string;
  source: string;
  seriesId: string;
  seriesTitle: string;
  chapterId: string;
  chapterName: string;
  page: number;
  note: string | null;
  status: BookmarkStatus;
  rejectReason: string | null;
  createdAt: string;
  reviewedBy: string | null;
};

type Row = {
  id: string;
  source: string;
  series_id: string;
  series_title: string;
  chapter_id: string;
  chapter_name: string;
  page: number;
  note: string | null;
  status: BookmarkStatus;
  reject_reason: string | null;
  created_at: string | Date;
  reviewed_by: string | null;
};

export async function listBookmarkRequests(status: BookmarkStatus): Promise<BookmarkRequest[]> {
  await ensureSchema();
  const rows = (await db().query(
    // Pending ones oldest first (work through the queue); the rest newest first.
    `select * from community_bookmarks where status = $1 order by created_at ${status === 'pending' ? 'asc' : 'desc'} limit 200`,
    [status],
  )) as Row[];
  return rows.map((r) => ({
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
    reviewedBy: r.reviewed_by,
  }));
}

export async function bookmarkCounts(): Promise<Record<BookmarkStatus, number>> {
  await ensureSchema();
  const rows = await db().query('select status, count(*)::int as n from community_bookmarks group by status');
  const out: Record<BookmarkStatus, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const r of rows) out[r.status as BookmarkStatus] = Number(r.n);
  return out;
}

export async function reviewBookmark(id: string, status: BookmarkStatus, by: string, reason?: string) {
  await ensureSchema();
  const rows = await db().query(
    `update community_bookmarks set status = $1, reject_reason = $2, reviewed_at = now(), reviewed_by = $3
     where id = $4 returning id`,
    [status, status === 'rejected' ? reason?.trim().slice(0, 200) || null : null, by, id],
  );
  if (!rows.length) throw new Error('That request no longer exists.');
}

export async function deleteBookmarkRequest(id: string) {
  await ensureSchema();
  await db().query('delete from community_bookmarks where id = $1', [id]);
}
