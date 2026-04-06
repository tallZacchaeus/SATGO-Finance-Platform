import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { serializeDoc } from '@/lib/firestore';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as { id: string };
    const db = getAdminDb();

    const snap = await db
      .collection('notifications')
      .where('user_id', '==', user.id)
      .orderBy('created_at', 'desc')
      .limit(50)
      .get();

    const notifications = snap.docs.map((d) => serializeDoc(d.id, d.data()));

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('GET /api/notifications error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// Mark all notifications as read
export async function PATCH() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as { id: string };
    const db = getAdminDb();

    const unreadSnap = await db
      .collection('notifications')
      .where('user_id', '==', user.id)
      .where('read', '==', false)
      .get();

    if (!unreadSnap.empty) {
      const batch = db.batch();
      unreadSnap.docs.forEach((d) => batch.update(d.ref, { read: true }));
      await batch.commit();
    }

    return NextResponse.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('PATCH /api/notifications error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
