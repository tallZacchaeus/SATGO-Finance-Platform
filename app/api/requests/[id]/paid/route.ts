import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { auth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { serializeDoc } from '@/lib/firestore';
import { formatCurrency } from '@/lib/utils';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as { id: string; role?: string };
    if (user.role !== 'admin') {
      return NextResponse.json({ message: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const db = getAdminDb();

    const reqDoc = await db.collection('requests').doc(params.id).get();
    if (!reqDoc.exists) {
      return NextResponse.json({ message: 'Request not found' }, { status: 404 });
    }

    const existing = reqDoc.data()!;

    if (existing.status !== 'approved') {
      return NextResponse.json(
        {
          message: `Only approved requests can be marked as paid. Current status: ${existing.status}`,
        },
        { status: 400 }
      );
    }

    const now = FieldValue.serverTimestamp();

    await db.collection('requests').doc(params.id).update({
      status: 'paid',
      paid_at: now,
      updated_at: now,
    });

    const updatedDoc = await db.collection('requests').doc(params.id).get();
    const updated = serializeDoc(updatedDoc.id, updatedDoc.data()!);

    // Audit log
    await db.collection('audit_logs').add({
      request_id: params.id,
      action: 'request_paid',
      user_id: user.id,
      metadata: { amount: existing.amount, paid_at: new Date().toISOString() },
      timestamp: now,
    });

    // Notify requester
    await db.collection('notifications').add({
      user_id: existing.user_id,
      request_id: params.id,
      title: 'Payment Processed',
      message: `Your request for ${formatCurrency(existing.amount)} has been paid. Please provide a receipt when available.`,
      read: false,
      created_at: now,
    });

    return NextResponse.json({ request: updated, message: 'Request marked as paid' });
  } catch (error) {
    console.error('POST /api/requests/[id]/paid error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
