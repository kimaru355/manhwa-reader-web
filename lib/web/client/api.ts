'use client';

import { useSyncExternalStore } from 'react';

export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: { id: string; email: string };
};

const KEY = 'w_session';
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: Session | null = null;

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedValue = raw ? (JSON.parse(raw) as Session) : null;
    }
    return cachedValue;
  } catch {
    return null;
  }
}

function store(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    // Blocked storage: signing in just won't stick.
  }
  listeners.forEach((l) => l());
}

export function useSession(): Session | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSession,
    () => null,
  );
}

export class ApiFailure extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: { 'Content-Type': 'application/json', ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiFailure("Couldn't reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return null as T;
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!res.ok) throw new ApiFailure(body?.error?.message ?? 'Something went wrong. Try again.', res.status);
  return body as T;
}

export async function signIn(email: string, password: string) {
  const res = await call<{ session: Session }>('/auth/signin', { body: { email, password } });
  store(res.session);
}

/** Returns true when the email must be confirmed before signing in. */
export async function signUp(email: string, password: string) {
  const res = await call<{ needsConfirmation: boolean; session?: Session }>('/auth/signup', { body: { email, password } });
  if (res.session) store(res.session);
  return res.needsConfirmation;
}

export async function signOut() {
  const s = getSession();
  store(null);
  if (s) await call('/auth/signout', { body: { refreshToken: s.refreshToken } }).catch(() => {});
}

export const forgotPassword = (email: string) => call('/auth/forgot', { body: { email } }).then(() => undefined);

async function fresh(force: boolean): Promise<Session> {
  const s = getSession();
  if (!s) throw new ApiFailure('Sign in to do that.', 401);
  if (!force && s.expiresAt - 60 > Date.now() / 1000) return s;
  try {
    const res = await call<{ session: Session }>('/auth/refresh', { body: { refreshToken: s.refreshToken } });
    store(res.session);
    return res.session;
  } catch (e) {
    if (e instanceof ApiFailure && (e.status === 400 || e.status === 401)) {
      store(null);
      throw new ApiFailure('Your session ended. Please sign in again.', 401);
    }
    throw e;
  }
}

/** Calls a signed-in endpoint, refreshing the access token when needed. */
export async function authed<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  try {
    return await call<T>(path, { ...init, token: (await fresh(false)).accessToken });
  } catch (e) {
    if (e instanceof ApiFailure && e.status === 401 && getSession()) {
      return call<T>(path, { ...init, token: (await fresh(true)).accessToken });
    }
    throw e;
  }
}

/** A public endpoint; with a login the server can add per-reader details such as your votes. */
export async function publicGet<T>(path: string): Promise<T> {
  if (!getSession()) return call<T>(path);
  try {
    return await call<T>(path, { token: (await fresh(false)).accessToken });
  } catch {
    return call<T>(path);
  }
}
