'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { RecommendBox } from '@/components/RecommendBox';
import { readHref } from '@/lib/web/links';
import {
  removeBookmark,
  toggleItem,
  useBookmarks,
  useFavorites,
  useRecents,
  useWishlist,
  type Item,
} from '@/lib/web/client/store';

type Ch = { id: string; name: string };
type Mark = { id?: string; chapterId: string; chapterName?: string; page?: number; note?: string };

export function SeriesView({
  item,
  chapters,
  author,
  community,
  kind,
}: {
  item: Item;
  chapters: Ch[];
  author: Mark[];
  community: Mark[];
  kind: 'images' | 'text';
}) {
  const favorites = useFavorites();
  const wishlist = useWishlist();
  const recents = useRecents();
  const allMarks = useBookmarks();
  const [newestFirst, setNewestFirst] = useState(true);

  const isFav = favorites.some((f) => f.key === item.key);
  const isWish = wishlist.some((f) => f.key === item.key);
  const progress = recents.find((r) => r.series.key === item.key);
  const mine = allMarks.filter((b) => b.seriesKey === item.key);
  const names = useMemo(() => new Map(chapters.map((c, i) => [c.id, { name: c.name, index: i }])), [chapters]);
  const resumeIdx = progress ? (names.get(progress.chapterId)?.index ?? -1) : -1;

  // Every bookmark of a chapter, shown under it in the list: the author's, the community's and your own.
  type Note = { key: string; by: string; page?: number; note?: string; mine?: string };
  const notesByChapter = useMemo(() => {
    const map = new Map<string, Note[]>();
    const add = (chapterId: string, n: Note) => map.set(chapterId, [...(map.get(chapterId) ?? []), n]);
    author.forEach((m, i) => add(m.chapterId, { key: `a${i}`, by: 'Author', page: m.page, note: m.note }));
    community.forEach((m, i) => add(m.chapterId, { key: `c${m.id ?? i}`, by: 'Community', page: m.page, note: m.note }));
    mine.forEach((b) => add(b.chapterId, { key: `m${b.id}`, by: 'Yours', page: b.page, note: b.note, mine: b.id }));
    for (const list of map.values()) list.sort((x, y) => (x.page ?? 0) - (y.page ?? 0));
    return map;
  }, [author, community, mine]);

  const rows = chapters.map((c, i) => ({ c, i }));
  if (newestFirst) rows.reverse();

  const open = (chapterId: string, page = 1) => readHref(item, chapterId, page);

  return (
    <>
      <div className="actions">
        {chapters.length ? (
          <Link
            className="btn2"
            href={progress && resumeIdx >= 0 ? open(progress.chapterId, progress.page) : open(chapters[0].id)}
          >
            {progress && resumeIdx >= 0 ? `Continue · ${names.get(progress.chapterId)?.name}` : 'Start reading'}
          </Link>
        ) : null}
        <button className={`btn2 ${isFav ? 'on' : 'ghost'}`} onClick={() => toggleItem('favorites', item)}>
          {isFav ? '♥ Favorite' : '♡ Favorite'}
        </button>
        <button className={`btn2 ${isWish ? 'on' : 'ghost'}`} onClick={() => toggleItem('wishlist', item)}>
          {isWish ? '✓ On wishlist' : '+ Wishlist'}
        </button>
        <RecommendBox item={item} />
      </div>

      {chapters.length ? (
        <>
          <div className="tier">
            <h2>Chapters</h2>
            <button className="chip" onClick={() => setNewestFirst((v) => !v)}>
              {newestFirst ? 'Newest first ↓' : 'Oldest first ↑'}
            </button>
          </div>
          <div className="chlist">
            {rows.map(({ c, i }) => {
              const notes = notesByChapter.get(c.id) ?? [];
              return (
                <div key={c.id} className={`ch ${resumeIdx === i ? 'cur' : resumeIdx >= 0 && i < resumeIdx ? 'read' : ''}`}>
                  <Link href={open(c.id, resumeIdx === i && progress ? progress.page : 1)} className="chl">
                    <span className="nm">{c.name}</span>
                    {resumeIdx === i && kind === 'images' && progress ? (
                      <span className="tag2">
                        p.{progress.page}/{progress.total || '?'}
                      </span>
                    ) : null}
                  </Link>
                  {notes.map((n) => (
                    <div className="cn" key={n.key}>
                      <Link href={open(c.id, n.page ?? 1)} className="cn-t">
                        <span className="by">{n.by}</span>
                        {kind === 'images' && n.page ? <span className="pp">p.{n.page}</span> : null}
                        {n.note ? <span className="note">{n.note}</span> : null}
                      </Link>
                      {n.mine ? (
                        <button aria-label="Remove bookmark" onClick={() => removeBookmark(n.mine!)}>
                          ✕
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </>
  );
}
