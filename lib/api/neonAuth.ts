import { ApiError, E } from './http';
import { decodeExp } from './auth';

/**
 * Talks to the Neon Auth REST API directly (the mobile app has no browser cookies).
 * The Auth service only accepts calls from trusted origins, so we send this site's origin.
 * Add that origin in Neon Console -> Auth -> Domains.
 */
const base = () => process.env.NEON_AUTH_BASE_URL!;
const origin = () => process.env.SITE_ORIGIN || 'https://manhwa-reader-web.vercel.app';

export type Session = {
  accessToken: string;
  /** Opaque: the Neon Auth session cookie. Only ever sent back to /auth/refresh and /auth/signout. */
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
  user: { id: string; email: string };
};

type Raw = { status: number; body: Record<string, unknown> | null; headers: Headers };

async function call(path: string, init: { method?: string; json?: unknown; cookie?: string } = {}): Promise<Raw> {
  const res = await fetch(`${base()}${path}`, {
    method: init.method ?? (init.json ? 'POST' : 'GET'),
    headers: {
      Origin: origin(),
      'Content-Type': 'application/json',
      ...(init.cookie ? { Cookie: init.cookie } : {}),
    },
    body: init.json ? JSON.stringify(init.json) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let body: Record<string, unknown> | null = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body, headers: res.headers };
}

/** Friendly messages for the codes Better Auth returns. Raw server text is never passed on. */
function fail(r: Raw): never {
  const code = String(r.body?.code ?? '');
  const msg = String(r.body?.message ?? '');
  if (/INVALID_EMAIL_OR_PASSWORD|INVALID_PASSWORD|USER_NOT_FOUND/.test(code)) throw E.creds();
  if (/EXISTS|ALREADY/.test(code)) throw E.conflict('An account with this email already exists. Try signing in.');
  if (/EMAIL_NOT_VERIFIED/.test(code)) throw E.forbidden('Confirm your email first: check your inbox for the link.');
  if (/PASSWORD_TOO_SHORT|PASSWORD_TOO_LONG/.test(code)) throw E.invalid('Choose a longer password (at least 8 characters).');
  if (/INVALID_EMAIL/.test(code)) throw E.invalid('Enter a valid email address.');
  if (/INVALID_TOKEN|TOKEN_EXPIRED/.test(code)) throw E.invalid('That reset link has expired. Request a new one.');
  if (r.status === 429) throw E.limited();
  if (r.status === 401) throw E.unauthorized();
  console.error('neon auth error', r.status, code, msg.slice(0, 120));
  throw new ApiError(502, 'server_error', 'Sign-in is unavailable right now. Try again later.');
}

/** `name=value` of the session cookie the Auth service set, if any. */
function sessionCookie(h: Headers): string | null {
  const all = h.getSetCookie?.() ?? [];
  const c = all.map((s) => s.split(';')[0]).find((s) => /session_token=/.test(s));
  return c ?? null;
}

/** Exchanges a session cookie for a short-lived JWT. */
async function toSession(cookie: string): Promise<Session> {
  const r = await call('/get-session', { cookie });
  const jwt = r.headers.get('set-auth-jwt');
  const user = (r.body?.user ?? null) as { id?: string; email?: string } | null;
  if (!jwt || !user?.id) throw E.unauthorized();
  return {
    accessToken: jwt,
    refreshToken: sessionCookie(r.headers) ?? cookie,
    expiresAt: decodeExp(jwt),
    user: { id: user.id, email: user.email ?? '' },
  };
}

export async function signUp(email: string, password: string): Promise<{ needsConfirmation: boolean; session?: Session }> {
  const r = await call('/sign-up/email', { json: { email, password, name: email.split('@')[0] } });
  if (r.status >= 400) fail(r);
  const cookie = sessionCookie(r.headers);
  if (!cookie) return { needsConfirmation: true };
  return { needsConfirmation: false, session: await toSession(cookie) };
}

export async function signIn(email: string, password: string): Promise<Session> {
  const r = await call('/sign-in/email', { json: { email, password } });
  if (r.status >= 400) fail(r);
  const cookie = sessionCookie(r.headers);
  if (!cookie) throw new ApiError(502, 'server_error', 'Sign-in is unavailable right now. Try again later.');
  return toSession(cookie);
}

export const refresh = (refreshToken: string) => toSession(refreshToken);

export async function signOut(refreshToken: string): Promise<void> {
  await call('/sign-out', { json: {}, cookie: refreshToken }).catch(() => {});
}

/** Never reveals whether the email exists. */
export async function forgot(email: string): Promise<void> {
  const redirectTo = `${origin()}/reset-password`;
  let r = await call('/request-password-reset', { json: { email, redirectTo } }).catch(() => null);
  if (r && r.status === 404) r = await call('/forget-password', { json: { email, redirectTo } }).catch(() => null);
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const r = await call('/reset-password', { json: { token, newPassword } });
  if (r.status >= 400) fail(r);
}
