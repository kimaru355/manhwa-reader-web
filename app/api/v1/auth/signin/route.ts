import { body, json, route } from '@/lib/api/http';
import * as neon from '@/lib/api/neonAuth';
import { signInBody } from '@/lib/api/schemas';

export const POST = route(
  async ({ req }) => {
    const { email, password } = await body(req, signInBody);
    return json({ session: await neon.signIn(email, password) });
  },
  { rate: 'auth' },
);
