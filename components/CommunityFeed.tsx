'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiFailure, authed, publicGet, useSession } from '@/lib/web/client/api';
import { imgUrl, seriesHref } from '@/lib/web/links';

type Rec = {
  id: string;
  source: string;
  seriesId: string;
  title: string;
  cover: string | null;
  category: string;
  tier: string;
  note: string | null;
  votes: number;
  voted: boolean;
};

const SORTS: [string, string][] = [
  ['latest', 'Latest'],
  ['popular', 'Popular'],
  ['week', 'This week'],
];
const CATEGORIES: [string, string][] = [
  ['all', 'All'],
  ['manga', 'Manga'],
  ['manhwa', 'Manhwa'],
  ['novel', 'Novels'],
  ['adult', '18+'],
];
const TIERS: [string, string][] = [
  ['all', 'Any tier'],
  ['all-time', 'All-time'],
  ['interesting', 'Interesting'],
  ['good', 'Good'],
  ['trial', 'Worth a trial'],
];
const TIER_LABEL = Object.fromEntries(TIERS);
const PROXIED = new Set(['webtoons', 'hentai20']);

export function CommunityFeed({ adultEnabled }: { adultEnabled: boolean }) {
  const session = useSession();
  const [sort, setSort] = useState('latest');
  const [category, setCategory] = useState('all');
  const [tier, setTier] = useState('all');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Rec[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const run = useRef(0);
  const authKey = session?.user.id ?? '';

  const load = useCallback(
    async (reset: boolean, from: string | null) => {
      const mine = reset ? ++run.current : run.current;
      setLoading(true);
      setError(null);
      const p = new URLSearchParams({ sort, limit: '20' });
      if (query.trim()) p.set('q', query.trim());
      if (tier !== 'all') p.set('tier', tier);
      if (category === 'adult') {
        p.set('category', 'interesting');
        p.set('adult', '1');
      } else if (category !== 'all') p.set('category', category);
      if (!reset && from) p.set('cursor', from);
      try {
        const res = await publicGet<{ items: Rec[]; nextCursor: string | null }>(`/recommendations/community?${p}`);
        if (mine !== run.current) return;
        setItems((prev) => {
          const seen = new Set((reset ? [] : prev).map((r) => r.id));
          return [...(reset ? [] : prev), ...res.items.filter((r) => !seen.has(r.id))];
        });
        setCursor(res.nextCursor);
      } catch (e) {
        if (mine === run.current) setError(e instanceof ApiFailure ? e.message : "Couldn't load the community.");
      } finally {
        if (mine === run.current) setLoading(false);
      }
    },
    [sort, category, tier, query],
  );

  // Any filter change starts over; typing waits a moment so each keystroke isn't a request. Signing in or out reloads
  // so the vote marks are right.
  useEffect(() => {
    const t = setTimeout(() => load(true, null), query ? 400 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, authKey]);

  const toggleVote = async (rec: Rec) => {
    if (!session) {
      setNotice('Sign in to vote. An account is only needed to vote, not to read.');
      return;
    }
    setNotice(null);
    const set = (voted: boolean, votes: number) => setItems((prev) => prev.map((r) => (r.id === rec.id ? { ...r, voted, votes } : r)));
    set(!rec.voted, Math.max(rec.votes + (rec.voted ? -1 : 1), 0));
    try {
      const res = await authed<{ votes: number; voted: boolean }>(`/community/recommendations/${encodeURIComponent(rec.id)}/vote`, {
        method: rec.voted ? 'DELETE' : 'PUT',
      });
      set(res.voted, res.votes);
    } catch (e) {
      set(rec.voted, rec.votes);
      setNotice(e instanceof ApiFailure ? e.message : "Couldn't save your vote.");
    }
  };

  const cats = CATEGORIES.filter(([c]) => c !== 'adult' || adultEnabled);

  return (
    <>
      <form
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
          load(true, null);
        }}
      >
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search community picks" />
      </form>
      <div className="chips">
        {SORTS.map(([v, l]) => (
          <button key={v} className={`chip ${sort === v ? 'on' : ''}`} onClick={() => setSort(v)}>
            {l}
          </button>
        ))}
      </div>
      <div className="chips">
        {cats.map(([v, l]) => (
          <button key={v} className={`chip ${category === v ? 'on' : ''}`} onClick={() => setCategory(v)}>
            {l}
          </button>
        ))}
      </div>
      <div className="chips">
        {TIERS.map(([v, l]) => (
          <button key={v} className={`chip ${tier === v ? 'on' : ''}`} onClick={() => setTier(v)}>
            {l}
          </button>
        ))}
      </div>

      {notice ? (
        <div className="err">
          {notice}{' '}
          {!session ? (
            <Link href="/account" style={{ textDecoration: 'underline' }}>
              Sign in
            </Link>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <div className="err">
          {error}{' '}
          <button className="chip" onClick={() => load(true, null)}>
            Try again
          </button>
        </div>
      ) : null}

      {items.map((r) => (
        <div className="row" key={r.id}>
          <Link
            href={seriesHref({ source: r.source, id: r.seriesId, title: r.title, cover: r.cover ?? undefined, category: r.category })}
            className="cv"
          >
            {r.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgUrl(r.cover, PROXIED.has(r.source))} alt="" loading="lazy" referrerPolicy="no-referrer" />
            ) : null}
          </Link>
          <Link
            className="info"
            href={seriesHref({ source: r.source, id: r.seriesId, title: r.title, cover: r.cover ?? undefined, category: r.category })}
          >
            <b>{r.title}</b>
            <span style={{ color: 'var(--accent)', fontSize: '.8rem' }}>
              {TIER_LABEL[r.tier] ?? r.tier} · {r.category === 'interesting' ? '18+' : r.category}
            </span>
            {r.note ? <small>{r.note}</small> : null}
          </Link>
          <button className={`vote ${r.voted ? 'on' : ''}`} onClick={() => toggleVote(r)} aria-label={r.voted ? 'Remove vote' : 'Upvote'}>
            ▲<span>{r.votes}</span>
          </button>
        </div>
      ))}

      {loading ? <div className="empty">Loading…</div> : null}
      {!loading && !error && items.length === 0 ? (
        <div className="empty">
          <b>Nothing here yet</b>No one has shared a recommendation that matches. Open a title and tap Recommend to be the first.
        </div>
      ) : null}
      {!loading && cursor ? (
        <div className="pager">
          <button className="btn2 ghost" onClick={() => load(false, cursor)}>
            Load more
          </button>
        </div>
      ) : null}
    </>
  );
}
