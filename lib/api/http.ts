import { randomUUID } from 'node:crypto';
import type { ZodType } from 'zod';
import { checkRate, type RateKind } from './ratelimit';

export type ErrorCode =
  | 'invalid_input'
  | 'invalid_credentials'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'conflict'
  | 'server_error';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const E = {
  invalid: (m = 'Check the details and try again.') => new ApiError(400, 'invalid_input', m),
  creds: () => new ApiError(401, 'invalid_credentials', 'Wrong email or password.'),
  unauthorized: (m = 'Please sign in again.') => new ApiError(401, 'unauthorized', m),
  forbidden: (m = "You can't do that.") => new ApiError(403, 'forbidden', m),
  notFound: (m = 'Not found.') => new ApiError(404, 'not_found', m),
  conflict: (m: string) => new ApiError(409, 'conflict', m),
  limited: (m = 'Too many requests. Wait a minute and try again.') => new ApiError(429, 'rate_limited', m),
};

export type Ctx<P = Record<string, string>> = {
  req: Request;
  rid: string;
  ip: string;
  params: P;
  /** Applies a rate limit. Use the user id once known; otherwise the IP is used. */
  rate: (kind: RateKind, userId?: string) => Promise<void>;
};

const clientIp = (req: Request) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';

export const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(data, { status, headers });

export const noContent = () => new Response(null, { status: 204 });

/**
 * Wraps a route: request id, error format, rate limiting. Handlers return a Response (or throw ApiError).
 * Nothing the user sent (passwords, tokens, notes) is ever logged.
 */
export function route<P = Record<string, string>>(
  fn: (ctx: Ctx<P>) => Promise<Response>,
  opts: { rate?: RateKind } = {},
) {
  return async (req: Request, extra?: { params: Promise<P> }): Promise<Response> => {
    const rid = randomUUID();
    const ip = clientIp(req);
    const ctx: Ctx<P> = {
      req,
      rid,
      ip,
      params: (await extra?.params) ?? ({} as P),
      rate: (kind, userId) => checkRate(kind, userId ? `u:${userId}` : `ip:${ip}`),
    };
    try {
      if (opts.rate) await ctx.rate(opts.rate);
      const res = await fn(ctx);
      res.headers.set('x-request-id', rid);
      return res;
    } catch (e) {
      if (e instanceof ApiError) {
        return json({ error: { code: e.code, message: e.message, requestId: rid } }, e.status, {
          'x-request-id': rid,
          ...(e.code === 'rate_limited' ? { 'Retry-After': '30' } : {}),
        });
      }
      console.error(`[${rid}] ${req.method} ${new URL(req.url).pathname} failed:`, (e as Error)?.message);
      return json(
        { error: { code: 'server_error', message: 'Something went wrong on our side. Try again later.', requestId: rid } },
        500,
        { 'x-request-id': rid },
      );
    }
  };
}

const MAX_BODY = 1_000_000;

/** Reads and validates a JSON body. Unknown fields are rejected by the (strict) schemas. */
export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_BODY) throw new ApiError(413, 'invalid_input', 'That request is too large.');
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw E.invalid('Send a JSON body.');
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw E.invalid(firstIssue(r.error.issues[0]));
  return r.data;
}

export function query<T>(req: Request, schema: ZodType<T>): T {
  const raw = Object.fromEntries(new URL(req.url).searchParams);
  const r = schema.safeParse(raw);
  if (!r.success) throw E.invalid(firstIssue(r.error.issues[0]));
  return r.data;
}

// Messages name the field but never echo what the user typed.
function firstIssue(i?: { path: PropertyKey[]; message: string; code: string }) {
  if (!i) return 'Check the details and try again.';
  const field = i.path.length ? String(i.path[i.path.length - 1]) : 'request';
  if (i.code === 'unrecognized_keys') return 'The request has fields we do not accept.';
  return `Check "${field}" and try again.`;
}
