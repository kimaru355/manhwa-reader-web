import { body, noContent, route } from '@/lib/api/http';
import * as neon from '@/lib/api/neonAuth';
import { resetBody } from '@/lib/api/schemas';

/** Used by the /reset-password page that the emailed link opens. */
export const POST = route(
  async ({ req }) => {
    const { token, password } = await body(req, resetBody);
    await neon.resetPassword(token, password);
    return noContent();
  },
  { rate: 'auth' },
);
