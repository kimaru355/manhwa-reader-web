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

  const marked = useMemo(() => {
    const ids = new Set<string>();
    for (const m of [...author, ...community, ...mine.map((b) => ({ chapterId: b.chapterId }))]) ids.add(m.chapterId);
    return ids;
  }, [author, community, mine]);

  const rows = chapters.map((c, i) => ({ c, i }));
  if (newestFirst) rows.reverse();

  const open = (chapterId: string, page = 1) => readHref(item, chapterId, page);

  const markRow = (m: Mark, by: string, onRemove?: () => void) => {
    const ch = names.get(m.chapterId);
    return (
      <div className="mark" key={`${by}-${m.id ?? `${m.chapterId}-${m.page}`}`}>
        <span className="by">{by}</span>
        <div className="grow">
          <Link href={open(m.chapterId, m.page ?? 1)}>
            {m.chapterName ?? ch?.name ?? m.chapterId}
            {kind === 'images' && m.page ? ` · p.${m.page}` : ''}
          </Link>
          {m.note ? <div className="note">{m.note}</div> : null}
        </div>
        {onRemove ? <button onClick={onRemove}>Remove</button> : null}
      </div>
    );
  };

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

      {author.length || community.length || mine.length ? (
        <div className="panel">
          <h3>Bookmarks</h3>
          {author.map((m) => markRow(m, 'Author'))}
          {community.map((m) => markRow(m, 'Community'))}
          {mine.map((b) =>
            markRow({ id: b.id, chapterId: b.chapterId, chapterName: b.chapterName, page: b.page, note: b.note }, 'Yours', () =>
              removeBookmark(b.id),
            ),
          )}
        </div>
      ) : null}

      {chapters.length ? (
        <>
          <div className="tier">
            <h2>Chapters</h2>
            <button className="chip" onClick={() => setNewestFirst((v) => !v)}>
              {newestFirst ? 'Newest first ↓' : 'Oldest first ↑'}
            </button>
          </div>
          <div className="chlist">
            {rows.map(({ c, i }) => (
              <Link
                key={c.id}
                href={open(c.id, resumeIdx === i && progress ? progress.page : 1)}
                className={`ch ${resumeIdx === i ? 'cur' : resumeIdx >= 0 && i < resumeIdx ? 'read' : ''}`}
              >
                <span className="nm">{c.name}</span>
                {marked.has(c.id) ? <span className="tag2">★</span> : null}
                {resumeIdx === i && kind === 'images' && progress ? (
                  <span className="tag2">
                    p.{progress.page}/{progress.total || '?'}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
