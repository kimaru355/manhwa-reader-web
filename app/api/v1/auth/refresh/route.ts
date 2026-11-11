import { body, json, route } from '@/lib/api/http';
import * as neon from '@/lib/api/neonAuth';
import { refreshBody } from '@/lib/api/schemas';

export const POST = route(
  async ({ req }) => {
    const { refreshToken } = await body(req, refreshBody);
    return json({ session: await neon.refresh(refreshToken) });
  },
  { rate: 'auth' },
);
