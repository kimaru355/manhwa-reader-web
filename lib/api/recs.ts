export type RecRow = {
  id: string;
  source: string;
  series_id: string;
  title: string;
  cover: string | null;
  url: string | null;
  category: string;
  tier: string;
  note: string | null;
  created_at: string | Date;
};

/** Public shape. No user id or email, ever. */
export const publicRec = (r: RecRow) => ({
  id: r.id,
  source: r.source,
  seriesId: r.series_id,
  title: r.title,
  cover: r.cover,
  url: r.url,
  category: r.category,
  tier: r.tier,
  note: r.note,
  createdAt: new Date(r.created_at).toISOString(),
});
