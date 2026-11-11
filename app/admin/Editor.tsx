'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES, SOURCES, TIERS, type AuthorBookmark, type Rec, type Tier } from '@/lib/shared';
import { changeTier, importJson, removeRecommendation, saveRecommendation } from './actions';

const blank = (): Rec => ({ source: 'hentai20', seriesId: '', title: '', category: 'interesting', tier: 'trial', bookmarks: [] });

export default function Editor({ initial }: { initial: Rec[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState('');
  const [tier, setTierFilter] = useState<'all' | Tier>('all');
  const [editing, setEditing] = useState<Rec | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return initial.filter((r) => (tier === 'all' || r.tier === tier) && (!s || r.title.toLowerCase().includes(s)));
  }, [initial, q, tier]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of initial) c[r.tier] = (c[r.tier] ?? 0) + 1;
    return c;
  }, [initial]);

  function run(p: Promise<{ ok: true } | { ok: false; error: string }>, okText: string, after?: () => void) {
    start(async () => {
      const r = await p;
      if (r.ok) {
        setMsg({ ok: true, text: okText });
        after?.();
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  async function onImport(f: File | undefined) {
    if (!f) return;
    const text = await f.text();
    if (!confirm('This replaces ALL recommendations with the contents of this file. Continue?')) return;
    run(importJson(text), 'Imported.');
    if (file.current) file.current.value = '';
  }

  return (
    <>
      <div className="adm-bar">
        <input placeholder="Search title…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={tier} onChange={(e) => setTierFilter(e.target.value as 'all' | Tier)}>
          <option value="all">All tiers ({initial.length})</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t} ({counts[t] ?? 0})
            </option>
          ))}
        </select>
        <button className="btn primary" onClick={() => setEditing(blank())}>
          + Add
        </button>
        <button className="btn ghost" onClick={() => file.current?.click()}>
          Import JSON
        </button>
        <a className="btn ghost" href="/recommendations.json" target="_blank" rel="noreferrer">
          View live JSON
        </a>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
      </div>

      {msg && <p className={msg.ok ? 'adm-ok' : 'adm-error'}>{msg.text}</p>}

      <ul className="adm-list">
        {shown.map((r) => (
          <li key={r.id} className="adm-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {r.cover ? <img src={r.cover} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="adm-ph">{r.title[0]}</span>}
            <div className="adm-title">
              <b>{r.title}</b>
              <span className="adm-muted">
                {r.source} · {r.category}
                {r.bookmarks.length ? ` · ${r.bookmarks.length} bookmarks` : ''}
              </span>
            </div>
            <select
              value={r.tier}
              disabled={pending}
              onChange={(e) => run(changeTier(r.id!, e.target.value as Tier), 'Tier updated.')}
            >
              {TIERS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <button className="btn ghost" onClick={() => setEditing(structuredClone(r))}>
              Edit
            </button>
            <button
              className="btn danger"
              disabled={pending}
              onClick={() => confirm(`Delete "${r.title}"?`) && run(removeRecommendation(r.id!), 'Deleted.')}
            >
              Delete
            </button>
          </li>
        ))}
        {!shown.length && <li className="adm-muted">Nothing matches.</li>}
      </ul>

      {editing && (
        <Form
          rec={editing}
          pending={pending}
          onCancel={() => setEditing(null)}
          onSave={(r) => run(saveRecommendation(r), 'Saved.', () => setEditing(null))}
        />
      )}
    </>
  );
}

function Form({ rec, pending, onSave, onCancel }: { rec: Rec; pending: boolean; onSave: (r: Rec) => void; onCancel: () => void }) {
  const [r, setR] = useState(rec);
  const set = <K extends keyof Rec>(k: K, v: Rec[K]) => setR((p) => ({ ...p, [k]: v }));
  const setBm = (i: number, patch: Partial<AuthorBookmark>) =>
    set(
      'bookmarks',
      r.bookmarks.map((b, j) => (j === i ? { ...b, ...patch } : b)),
    );

  return (
    <div className="adm-modal" role="dialog" aria-modal="true">
      <form
        className="adm-card wide"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(r);
        }}
      >
        <h2>{r.id ? 'Edit recommendation' : 'Add recommendation'}</h2>
        <div className="adm-grid">
          <label>
            Source
            <select value={r.source} onChange={(e) => set('source', e.target.value as Rec['source'])}>
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            ID (MangaDex UUID, WEBTOON title_no, Hentai20 slug)
            <input required value={r.seriesId} onChange={(e) => set('seriesId', e.target.value)} />
          </label>
          <label className="span">
            Title
            <input required value={r.title} onChange={(e) => set('title', e.target.value)} />
          </label>
          <label>
            Category
            <select value={r.category} onChange={(e) => set('category', e.target.value as Rec['category'])}>
              {CATEGORIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Tier
            <select value={r.tier} onChange={(e) => set('tier', e.target.value as Tier)}>
              {TIERS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="span">
            Cover URL
            <input value={r.cover ?? ''} onChange={(e) => set('cover', e.target.value)} />
          </label>
          <label className="span">
            Link (for external titles)
            <input value={r.url ?? ''} onChange={(e) => set('url', e.target.value)} />
          </label>
          <label className="span">
            Note (why you recommend it)
            <textarea rows={2} value={r.note ?? ''} onChange={(e) => set('note', e.target.value)} />
          </label>
        </div>

        <h3>
          Chapter bookmarks <span className="adm-muted">({r.bookmarks.length})</span>
        </h3>
        <div className="adm-bms">
          {r.bookmarks.map((b, i) => (
            <div className="adm-bm" key={i}>
              <input placeholder="chapterId" value={b.chapterId} onChange={(e) => setBm(i, { chapterId: e.target.value })} />
              <input placeholder="Chapter name" value={b.chapterName ?? ''} onChange={(e) => setBm(i, { chapterName: e.target.value })} />
              <input
                placeholder="Page"
                type="number"
                min={1}
                value={b.page ?? ''}
                onChange={(e) => setBm(i, { page: e.target.value ? Number(e.target.value) : undefined })}
              />
              <input placeholder="Note" value={b.note ?? ''} onChange={(e) => setBm(i, { note: e.target.value })} />
              <button type="button" className="btn danger" onClick={() => set('bookmarks', r.bookmarks.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn ghost" onClick={() => set('bookmarks', [...r.bookmarks, { chapterId: '' }])}>
            + Add bookmark
          </button>
        </div>

        <div className="adm-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
