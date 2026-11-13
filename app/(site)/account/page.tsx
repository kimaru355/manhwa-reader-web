'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ApiFailure, forgotPassword, signIn, signOut, signUp, useSession } from '@/lib/web/client/api';

export default function Account() {
  const session = useSession();
  const [mode, setMode] = useState<'in' | 'up' | 'forgot'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setMsg(null);
    try {
      const text = await fn();
      if (text) setMsg({ ok: true, text });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiFailure ? e.message : 'Something went wrong. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  if (session) {
    return (
      <>
        <h1 className="page-title">Account</h1>
        <div className="panel" style={{ maxWidth: 480 }}>
          <p>
            Signed in as <b>{session.user.email}</b>.
          </p>
          <p className="meta">
            You can vote on community picks, recommend titles and suggest chapter bookmarks. Reading, favorites and your own
            bookmarks work without an account and stay in this browser.
          </p>
          <div className="actions">
            <Link className="btn2 ghost" href="/library">
              Your library
            </Link>
            <button className="btn2 ghost" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="page-title">{mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create an account' : 'Reset your password'}</h1>
      <p className="meta" style={{ maxWidth: 460 }}>
        Optional. An account is only needed to vote, recommend titles and suggest bookmarks, not to read.
      </p>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === 'in') run(() => signIn(email.trim(), password));
          else if (mode === 'up')
            run(async () => {
              const needs = await signUp(email.trim(), password);
              return needs ? 'Check your email to confirm your account, then sign in.' : undefined;
            });
          else
            run(async () => {
              await forgotPassword(email.trim());
              return 'If that email has an account, a reset link is on its way.';
            });
        }}
      >
        <label>
          Email
          <input className="field" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== 'forgot' ? (
          <label>
            Password
            <input
              className="field"
              type="password"
              required
              minLength={mode === 'up' ? 8 : 1}
              autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        ) : null}
        <button className="btn2" disabled={busy} type="submit">
          {mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}
        </button>
        {msg ? <div className={msg.ok ? 'ok' : 'err'}>{msg.text}</div> : null}
        <div className="actions">
          {mode !== 'in' ? (
            <button type="button" className="chip" onClick={() => setMode('in')}>
              Sign in
            </button>
          ) : null}
          {mode !== 'up' ? (
            <button type="button" className="chip" onClick={() => setMode('up')}>
              Create account
            </button>
          ) : null}
          {mode !== 'forgot' ? (
            <button type="button" className="chip" onClick={() => setMode('forgot')}>
              Forgot password
            </button>
          ) : null}
        </div>
      </form>
    </>
  );
}
