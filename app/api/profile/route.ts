import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { serializeDoc } from '@/lib/firestore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = session.user as { id: string };
    const db = getAdminDb();
    const doc = await db.collection('users').doc(currentUser.id).get();

    if (!doc.exists) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: serializeDoc(doc.id, doc.data()!) });
  } catch (error) {
    console.error('GET /api/profile error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
