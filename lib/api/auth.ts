import { createRemoteJWKSet, jwtVerify } from 'jose';
import { E } from './http';

const base = () => process.env.NEON_AUTH_BASE_URL!;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
const keys = () => (jwks ??= createRemoteJWKSet(new URL(`${base()}/.well-known/jwks.json`)));

export type AuthUser = { id: string; email: string };

/** Verifies `Authorization: Bearer <access token>` (a Neon Auth JWT) and returns the user. Throws 401. */
export async function requireUser(req: Request): Promise<AuthUser> {
  const h = req.headers.get('authorization') ?? '';
  const token = /^Bearer (.+)$/i.exec(h)?.[1];
  if (!token) throw E.unauthorized();
  try {
    const { payload } = await jwtVerify(token, keys(), { algorithms: ['EdDSA'] });
    const origin = new URL(base()).origin;
    if (typeof payload.iss === 'string' && !payload.iss.startsWith(origin)) throw new Error('issuer');
    const id = String(payload.sub ?? payload.id ?? '');
    if (!id) throw new Error('no subject');
    return { id, email: String(payload.email ?? '') };
  } catch {
    throw E.unauthorized();
  }
}

/** The signed-in user if a valid token was sent, otherwise null. Never throws. */
export async function optionalUser(req: Request): Promise<AuthUser | null> {
  if (!req.headers.get('authorization')) return null;
  try {
    return await requireUser(req);
  } catch {
    return null;
  }
}

export function decodeExp(jwt: string): number {
  try {
    const p = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
    return Number(p.exp) || Math.floor(Date.now() / 1000) + 900;
  } catch {
    return Math.floor(Date.now() / 1000) + 900;
  }
}
