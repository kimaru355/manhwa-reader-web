'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ApiFailure, authed, useSession } from '@/lib/web/client/api';
import type { Item } from '@/lib/web/client/store';

const TIERS: [string, string][] = [
  ['all-time', 'All-time'],
  ['interesting', 'Interesting'],
  ['good', 'Good'],
  ['trial', 'Worth a trial'],
];

/** Lets a signed-in reader recommend the title to the community. */
export function RecommendBox({ item }: { item: Item }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState('good');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await authed('/me/recommendations', {
        method: 'POST',
        body: {
          source: item.source,
          seriesId: item.id,
          title: item.title,
          cover: item.cover?.startsWith('http') ? item.cover : null,
          category: item.category,
          tier,
          note: note.trim() || null,
        },
      });
      setMsg({ ok: true, text: 'Shared with the community. Thank you!' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiFailure ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn2 ghost" onClick={() => setOpen((v) => !v)}>
        ★ Recommend
      </button>
      {open ? (
        <div className="panel" style={{ flexBasis: '100%' }}>
          {!session ? (
            <p>
              <Link href="/account" style={{ color: 'var(--accent)' }}>
                Sign in
              </Link>{' '}
              to recommend this to the community. An account is only needed to share, not to read.
            </p>
          ) : (
            <div className="form">
              <div className="chips" style={{ margin: 0 }}>
                {TIERS.map(([value, label]) => (
                  <button key={value} className={`chip ${tier === value ? 'on' : ''}`} onClick={() => setTier(value)}>
                    {label}
                  </button>
                ))}
              </div>
              <textarea
                className="field"
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why do you recommend it? (optional)"
              />
              <button className="btn2" disabled={busy} onClick={send}>
                Share recommendation
              </button>
              {msg ? <div className={msg.ok ? 'ok' : 'err'}>{msg.text}</div> : null}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
