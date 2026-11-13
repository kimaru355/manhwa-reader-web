/** Address of a chapter in the reader. The title and cover travel along so the reader can show them. */
export function readHref(
  s: { source: string; id: string; title: string; cover?: string; category: string },
  chapterId: string,
  page = 1,
) {
  const p = new URLSearchParams({ t: s.title, k: s.category });
  if (s.cover) p.set('c', s.cover);
  if (page > 1) p.set('p', String(page));
  return `/read/${s.source}/${encodeURIComponent(s.id)}/${encodeURIComponent(chapterId)}?${p}`;
}

/** Address of a title's page. */
export function seriesHref(s: { source: string; id: string; title: string; cover?: string; category: string }) {
  const p = new URLSearchParams({ t: s.title, k: s.category });
  if (s.cover) p.set('c', s.cover);
  return `/series/${s.source}/${encodeURIComponent(s.id)}?${p}`;
}

/** Link to an image the browser can load: through our proxy when the host checks the Referer. */
export const imgUrl = (url: string | undefined, proxy: boolean) =>
  !url ? undefined : proxy ? `/api/img?u=${encodeURIComponent(url)}` : url;
