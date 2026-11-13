'use client';

import Link from 'next/link';
import { useState } from 'react';

import { imgUrl, readHref, seriesHref } from '@/lib/web/links';
import {
  clearRecents,
  removeBookmark,
  toggleItem,
  useBookmarks,
  useFavorites,
  useRecents,
  useWishlist,
  type Item,
} from '@/lib/web/client/store';

type Tab = 'recent' | 'favorites' | 'wishlist' | 'bookmarks';
const PROXIED = new Set(['webtoons', 'hentai20']);

function Thumb({ s }: { s: Item }) {
  const url = imgUrl(s.cover, PROXIED.has(s.source));
  return (
    <div className="cv">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : null}
    </div>
  );
}

export default function Library() {
  const [tab, setTab] = useState<Tab>('recent');
  const recents = useRecents();
  const favorites = useFavorites();
  const wishlist = useWishlist();
  const bookmarks = useBookmarks();
  const byKey = new Map([...favorites, ...wishlist, ...recents.map((r) => r.series)].map((s) => [s.key, s]));

  const tabs: [Tab, string, number][] = [
    ['recent', 'Recent', recents.length],
    ['favorites', 'Favorites', favorites.length],
    ['wishlist', 'Wishlist', wishlist.length],
    ['bookmarks', 'Bookmarks', bookmarks.length],
  ];

  const grid = (list: Item[], which: 'favorites' | 'wishlist') =>
    list.length ? (
      list.map((s) => (
        <div className="row" key={s.key}>
          <Link href={seriesHref(s)} className="cv">
            <Thumb s={s} />
          </Link>
          <Link href={seriesHref(s)} className="info">
            <b>{s.title}</b>
            <small>{s.source}</small>
          </Link>
          <button className="chip" onClick={() => toggleItem(which, s)}>
            Remove
          </button>
        </div>
      ))
    ) : (
      <div className="empty">
        <b>Nothing here yet</b>Open a title and tap {which === 'favorites' ? 'Favorite' : 'Wishlist'}.
      </div>
    );

  return (
    <>
      <h1 className="page-title">Your library</h1>
      <p className="meta">Kept in this browser. Use the Android app to download chapters and read offline.</p>
      <div className="chips">
        {tabs.map(([t, label, n]) => (
          <button key={t} className={`chip ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
            {label} ({n})
          </button>
        ))}
      </div>

      {tab === 'recent' ? (
        recents.length ? (
          <>
            {recents.map((r) => (
              <div className="row" key={r.series.key}>
                <Link href={seriesHref(r.series)} className="cv">
                  <Thumb s={r.series} />
                </Link>
                <Link href={readHref(r.series, r.chapterId, r.page)} className="info">
                  <b>{r.series.title}</b>
                  <small>
                    Continue · {r.chapterName}
                    {r.total > 1 ? ` · p.${r.page}/${r.total}` : ''}
                  </small>
                </Link>
              </div>
            ))}
            <div className="pager">
              <button className="btn2 ghost" onClick={clearRecents}>
                Clear history
              </button>
            </div>
          </>
        ) : (
          <div className="empty">
            <b>No reading history yet</b>Chapters you open show up here so you can pick up where you left off.
          </div>
        )
      ) : null}
      {tab === 'favorites' ? grid(favorites, 'favorites') : null}
      {tab === 'wishlist' ? grid(wishlist, 'wishlist') : null}
      {tab === 'bookmarks' ? (
        bookmarks.length ? (
          bookmarks.map((b) => {
            const s = byKey.get(b.seriesKey);
            return (
              <div className="mark" key={b.id}>
                <div className="grow">
                  {s ? (
                    <Link href={readHref(s, b.chapterId, b.page)}>
                      {s.title} · {b.chapterName} · p.{b.page}
                    </Link>
                  ) : (
                    <span>
                      {b.seriesKey} · {b.chapterName} · p.{b.page}
                    </span>
                  )}
                  {b.note ? <div className="note">{b.note}</div> : null}
                </div>
                <button onClick={() => removeBookmark(b.id)}>Remove</button>
              </div>
            );
          })
        ) : (
          <div className="empty">
            <b>No bookmarks yet</b>While reading, tap the bookmark button to save a page with a note.
          </div>
        )
      ) : null}
    </>
  );
}
