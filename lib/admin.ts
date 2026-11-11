import { auth } from '@/lib/auth/server';

/** Comma-separated list of emails allowed to edit. Anyone else who signs in is refused. */
const allowed = () =>
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export const isAllowedEmail = (email?: string | null) => !!email && allowed().includes(email.trim().toLowerCase());

/** Returns the signed-in admin's email, or null. Every admin page and action must call this. */
export async function getAdmin(): Promise<string | null> {
  const { data: session } = await auth.getSession();
  const email = session?.user?.email;
  return isAllowedEmail(email) ? email! : null;
}

export async function requireAdmin(): Promise<string> {
  const email = await getAdmin();
  if (!email) throw new Error('Not authorized');
  return email;
}
