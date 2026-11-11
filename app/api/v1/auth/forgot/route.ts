import { body, noContent, route } from '@/lib/api/http';
import * as neon from '@/lib/api/neonAuth';
import { forgotBody } from '@/lib/api/schemas';

/** Always 204, so this can't be used to find out which emails have accounts. */
export const POST = route(
  async ({ req }) => {
    const { email } = await body(req, forgotBody);
    await neon.forgot(email);
    return noContent();
  },
  { rate: 'auth' },
);
