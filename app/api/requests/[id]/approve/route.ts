import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { auth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { serializeDoc } from '@/lib/firestore';
import { sendRequestApprovedEmail } from '@/lib/email';
import { formatCurrency } from '@/lib/utils';

// Requests at or above this amount require explicit high-value confirmation.
// Override via APPROVAL_THRESHOLD_NGN env var.
const APPROVAL_THRESHOLD = parseInt(process.env.APPROVAL_THRESHOLD_NGN || '500000', 10);

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

    const body = await request.json().catch(() => ({})) as { confirmed?: boolean };
    const db = getAdminDb();

    const reqDoc = await db.collection('requests').doc(params.id).get();
    if (!reqDoc.exists) {
      return NextResponse.json({ message: 'Request not found' }, { status: 404 });
    }

    const existing = reqDoc.data()!;

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { message: `Cannot approve a request with status: ${existing.status}` },
        { status: 400 }
      );
    }

    // High-value approval gate — require explicit confirmation
    if (existing.amount >= APPROVAL_THRESHOLD && !body.confirmed) {
      return NextResponse.json(
        {
          message: `This request exceeds the approval threshold of ${formatCurrency(APPROVAL_THRESHOLD)}. Send { confirmed: true } to proceed.`,
          requires_confirmation: true,
          threshold: APPROVAL_THRESHOLD,
          amount: existing.amount,
        },
        { status: 409 }
      );
    }

    const now = FieldValue.serverTimestamp();

    await db.collection('requests').doc(params.id).update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: now,
      updated_at: now,
    });

    const updatedDoc = await db.collection('requests').doc(params.id).get();
    const updated = serializeDoc(updatedDoc.id, updatedDoc.data()!);

    // Audit log
    await db.collection('audit_logs').add({
      request_id: params.id,
      action: 'request_approved',
      user_id: user.id,
      metadata: {
        previous_status: 'pending',
        high_value: existing.amount >= APPROVAL_THRESHOLD,
      },
      timestamp: now,
    });

    // Notify the requester
    await db.collection('notifications').add({
      user_id: existing.user_id,
      request_id: params.id,
      title: 'Request Approved',
      message: `Your request for ${formatCurrency(existing.amount)} has been approved. Payment will be processed shortly.`,
      read: false,
      created_at: now,
    });

    // Fetch requester profile for email
    const requesterDoc = await db.collection('users').doc(existing.user_id as string).get();
    const requester = requesterDoc.data();

    if (requester?.email) {
      sendRequestApprovedEmail({
        to: requester.email as string,
        requestId: params.id,
        requesterName: (requester.name as string) || 'User',
        amount: existing.amount as number,
        purpose: existing.purpose as string,
      }).catch(console.error);
    }

    return NextResponse.json({ request: updated, message: 'Request approved successfully' });
  } catch (error) {
    console.error('POST /api/requests/[id]/approve error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
