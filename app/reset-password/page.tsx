'use client';

import { useState } from 'react';
import '../admin/admin.css';

export default function ResetPassword() {
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = new URLSearchParams(window.location.search).get('token');
    const password = String(new FormData(e.currentTarget).get('password') ?? '');
    if (!token) return setState({ ok: false, text: 'This link is missing its token. Request a new reset email in the app.' });
    setBusy(true);
    try {
      const res = await fetch('/api/v1/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) setState({ ok: true, text: 'Password changed. You can sign in from the app now.' });
      else setState({ ok: false, text: (await res.json().catch(() => null))?.error?.message ?? 'Could not change the password.' });
    } catch {
      setState({ ok: false, text: "Couldn't connect. Check your internet connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="adm-center">
      <form className="adm-card" onSubmit={submit}>
        <h1>Reset password</h1>
        <label>
          New password (8+ characters)
          <input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        {state && <p className={state.ok ? 'adm-ok' : 'adm-error'}>{state.text}</p>}
        <button className="btn primary" disabled={busy}>
          {busy ? 'Please wait…' : 'Change password'}
        </button>
      </form>
    </main>
  );
}
