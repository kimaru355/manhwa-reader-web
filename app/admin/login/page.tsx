'use client';

import { useActionState, useState } from 'react';
import { signIn, signUp } from './actions';
import '../admin.css';

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [state, action, pending] = useActionState(mode === 'in' ? signIn : signUp, null);

  return (
    <main className="adm-center">
      <form action={action} className="adm-card" key={mode}>
        <h1>{mode === 'in' ? 'Sign in' : 'Create admin account'}</h1>
        <p className="adm-muted">Manhwa Reader recommendations</p>
        {mode === 'up' && (
          <label>
            Name
            <input name="name" autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input name="password" type="password" required minLength={8} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
        </label>
        {state?.error && <p className="adm-error">{state.error}</p>}
        <button className="btn primary" disabled={pending}>
          {pending ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" className="adm-link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'First time? Create the admin account' : 'Back to sign in'}
        </button>
      </form>
    </main>
  );
}
