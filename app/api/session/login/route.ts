import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  getSessionCookieOptions,
} from '@/lib/auth';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { getIp, rateLimit } from '@/lib/rate-limit';

const loginSchema = z.object({
  email: z.string().email(),
  idToken: z.string().min(1),
});

const DEFAULT_POST_LOGIN_REDIRECT = '/dashboard';

function getSessionCreationErrorMessage(error: unknown) {
  if (
    error instanceof Error &&
    error.message.startsWith('Missing required Firebase Admin environment variable:')
  ) {
    return 'Server authentication is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.';
  }

  return 'Unable to create session.';
}

async function ensureUserProfile(params: {
  uid: string;
  email: string;
  name: string | null;
}) {
  const db = getAdminDb();
  const userRef = db.collection('users').doc(params.uid);
  const userDoc = await userRef.get();
  const normalizedEmail = params.email.toLowerCase();
  const normalizedName = params.name?.trim() || params.email;

  if (!userDoc.exists) {
    await userRef.set({
      email: normalizedEmail,
      name: normalizedName,
      role: 'requester',
      department: null,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    return;
  }

  const existing = userDoc.data() ?? {};
  const updates: Record<string, unknown> = {};

  if (typeof existing.email !== 'string' || existing.email.trim().length === 0) {
    updates.email = normalizedEmail;
  }

  if (typeof existing.name !== 'string' || existing.name.trim().length === 0) {
    updates.name = normalizedName;
  }

  if (existing.role !== 'admin' && existing.role !== 'requester') {
    updates.role = 'requester';
  }

  if (!('created_at' in existing)) {
    updates.created_at = FieldValue.serverTimestamp();
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = FieldValue.serverTimestamp();
    await userRef.set(updates, { merge: true });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = loginSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ message: 'Invalid login payload' }, { status: 400 });
    }

    const { email, idToken } = validated.data;
    const ip = getIp(request);
    const rateLimitKey = `login:${email.toLowerCase()}:${ip}`;

    if (!rateLimit(rateLimitKey, 10, 15 * 60 * 1000)) {
      return NextResponse.json(
        { message: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (!decodedToken.email || decodedToken.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ message: 'Unable to verify login.' }, { status: 401 });
    }

    await ensureUserProfile({
      uid: decodedToken.uid,
      email,
      name: typeof decodedToken.name === 'string' ? decodedToken.name : null,
    });

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    const response = NextResponse.json({ redirectTo: DEFAULT_POST_LOGIN_REDIRECT });
    response.cookies.set(
      SESSION_COOKIE_NAME,
      sessionCookie,
      getSessionCookieOptions()
    );

    return response;
  } catch (error) {
    console.error('POST /api/session/login error:', error);
    return NextResponse.json(
      { message: getSessionCreationErrorMessage(error) },
      { status: 500 }
    );
  }
}
