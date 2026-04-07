import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from './firebase-admin';

export interface AppSessionUser {
  id: string;
  email: string | null;
  name: string | null;
  role?: string;
}

export interface AppSession {
  user: AppSessionUser;
}

export const SESSION_COOKIE_NAME = 'nyaya_session';
export const SESSION_DURATION_MS = 60 * 60 * 8 * 1000;

const baseSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

function getOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function getUserRole(value: unknown): 'requester' | 'admin' {
  return value === 'admin' ? 'admin' : 'requester';
}

export function getSessionCookieOptions(maxAgeSeconds = SESSION_DURATION_MS / 1000) {
  return {
    ...baseSessionCookieOptions,
    maxAge: maxAgeSeconds,
  };
}

export function getClearedSessionCookieOptions() {
  return {
    ...baseSessionCookieOptions,
    maxAge: 0,
  };
}

export async function auth(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    const decodedToken = await getAdminAuth().verifySessionCookie(sessionCookie, true);

    let profile: Record<string, unknown> = {};
    try {
      const profileDoc = await getAdminDb().collection('users').doc(decodedToken.uid).get();
      if (profileDoc.exists) {
        profile = profileDoc.data() ?? {};
      }
    } catch (error) {
      console.error('auth profile lookup error:', error);
    }

    return {
      user: {
        id: decodedToken.uid,
        email: getOptionalString(profile.email) ?? decodedToken.email ?? null,
        name: getOptionalString(profile.name) ?? decodedToken.name ?? null,
        role: getUserRole(profile.role),
      },
    };
  } catch (error) {
    console.error('auth session verification error:', error);
    return null;
  }
}
