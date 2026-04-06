import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { auth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { serializeDoc } from '@/lib/firestore';
import { sendRequestRejectedEmail } from '@/lib/email';
import { formatCurrency } from '@/lib/utils';
import { z } from 'zod';

const rejectSchema = z.object({
  reason: z
    .string()
    .min(10, 'Please provide a detailed reason (at least 10 characters)')
    .max(500),
});

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

    const body = await request.json();
    const validated = rejectSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: validated.error.flatten() },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    const reqDoc = await db.collection('requests').doc(params.id).get();
    if (!reqDoc.exists) {
      return NextResponse.json({ message: 'Request not found' }, { status: 404 });
    }

    const existing = reqDoc.data()!;

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { message: `Cannot reject a request with status: ${existing.status}` },
        { status: 400 }
      );
    }

    const now = FieldValue.serverTimestamp();

    await db.collection('requests').doc(params.id).update({
      status: 'rejected',
      rejection_reason: validated.data.reason,
      reviewed_by: user.id,
      reviewed_at: now,
      updated_at: now,
    });

    const updatedDoc = await db.collection('requests').doc(params.id).get();
    const updated = serializeDoc(updatedDoc.id, updatedDoc.data()!);

    // Audit log
    await db.collection('audit_logs').add({
      request_id: params.id,
      action: 'request_rejected',
      user_id: user.id,
      metadata: { reason: validated.data.reason, previous_status: 'pending' },
      timestamp: now,
    });

    // Notify requester
    await db.collection('notifications').add({
      user_id: existing.user_id,
      request_id: params.id,
      title: 'Request Rejected',
      message: `Your request for ${formatCurrency(existing.amount)} has been rejected. Reason: ${validated.data.reason}`,
      read: false,
      created_at: now,
    });

    // Fetch requester profile for email
    const requesterDoc = await db.collection('users').doc(existing.user_id as string).get();
    const requester = requesterDoc.data();

    if (requester?.email) {
      sendRequestRejectedEmail({
        to: requester.email as string,
        requestId: params.id,
        requesterName: (requester.name as string) || 'User',
        amount: existing.amount as number,
        purpose: existing.purpose as string,
        reason: validated.data.reason,
      }).catch(console.error);
    }

    return NextResponse.json({ request: updated, message: 'Request rejected' });
  } catch (error) {
    console.error('POST /api/requests/[id]/reject error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
