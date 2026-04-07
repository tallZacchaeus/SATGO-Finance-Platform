import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getAdminDb } from './firebase-admin';
import { rateLimit } from './rate-limit';

const DEFAULT_POST_LOGIN_REDIRECT = '/dashboard';

/**
 * Verify email/password against Firebase Auth using the REST API.
 * Returns the Firebase UID on success, or null on failure.
 */
async function verifyFirebasePassword(
  email: string,
  password: string
): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );

  if (!res.ok) return null;

  const data = await res.json() as { localId?: string };
  return data.localId ?? null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // 10 login attempts per email per 15 minutes
        const key = `login:${String(credentials.email).toLowerCase()}`;
        if (!rateLimit(key, 10, 15 * 60 * 1000)) return null;

        const uid = await verifyFirebasePassword(
          credentials.email as string,
          credentials.password as string
        );

        if (!uid) return null;

        const db = getAdminDb();
        const profileDoc = await db.collection('users').doc(uid).get();

        if (!profileDoc.exists) return null;

        const profile = profileDoc.data()!;

        return {
          id: uid,
          email: profile.email as string,
          name: profile.name as string,
          role: profile.role as string,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/api/auth')) {
        return baseUrl + DEFAULT_POST_LOGIN_REDIRECT;
      }

      if (url.startsWith('/')) {
        return baseUrl + url;
      }

      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.origin === baseUrl && !parsedUrl.pathname.startsWith('/api/auth')) {
          return url;
        }
      } catch {}

      return baseUrl + DEFAULT_POST_LOGIN_REDIRECT;
    },
  },
  pages: {
    signIn: '/login',
  },
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 8, // 8 hours — forces re-login so role changes take effect
  },
});
