import { body, noContent, route } from '@/lib/api/http';
import * as neon from '@/lib/api/neonAuth';
import { signOutBody } from '@/lib/api/schemas';

/** Ends the server session when the refresh token is sent; always succeeds so the app can clear itself. */
export const POST = route(
  async ({ req }) => {
    const text = await req.text();
    if (text) {
      const { refreshToken } = await body(new Request(req.url, { method: 'POST', body: text }), signOutBody);
      if (refreshToken) await neon.signOut(refreshToken);
    }
    return noContent();
  },
  { rate: 'auth' },
);
