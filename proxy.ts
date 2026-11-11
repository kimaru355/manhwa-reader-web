import { auth } from '@/lib/auth/server';

// Redirects signed-out visitors to the login page. The admin page and every action re-check the allowlist.
export default auth.middleware({ loginUrl: '/admin/login' });

export const config = { matcher: ['/admin'] };
