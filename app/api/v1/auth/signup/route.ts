import { body, json, route } from '@/lib/api/http';
import * as neon from '@/lib/api/neonAuth';
import { signUpBody } from '@/lib/api/schemas';

export const POST = route(
  async ({ req }) => {
    const { email, password } = await body(req, signUpBody);
    return json(await neon.signUp(email, password), 201);
  },
  { rate: 'auth' },
);
