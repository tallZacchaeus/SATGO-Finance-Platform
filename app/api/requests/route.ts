import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { auth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { serializeDoc } from '@/lib/firestore';
import { sendRequestSubmittedEmail, sendAdminNotificationEmail } from '@/lib/email';
import { formatCurrency } from '@/lib/utils';
import { rateLimit, getIp } from '@/lib/rate-limit';
import { z } from 'zod';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

const createRequestSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  purpose: z.string().min(5).max(200),
  category: z.enum(['travel', 'supplies', 'events', 'utilities', 'personnel', 'other']),
  description: z.string().max(1000).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as { id: string; role?: string };
    const db = getAdminDb();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query — NOTE: compound queries (user_id + status + orderBy created_at)
    // require a composite index in the Firebase console.
    let q: FirebaseFirestore.Query = db
      .collection('requests')
      .orderBy('created_at', 'desc');

    if (user.role !== 'admin') {
      q = q.where('user_id', '==', user.id);
    }

    const allSnap = await q.get();

    // Filter by status in-memory to avoid needing additional composite indexes
    let docs = allSnap.docs;
    if (status && status !== 'all') {
      docs = docs.filter((d) => d.data().status === status);
    }

    const total = docs.length;
    const page = docs.slice(offset, offset + limit);

    // Batch-fetch unique user profiles
    const userIds = Array.from(
      new Set(page.map((d) => d.data().user_id as string).filter(Boolean))
    );
    const userCache = new Map<string, Record<string, unknown>>();
    await Promise.all(
      userIds.map(async (uid) => {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
          userCache.set(uid, serializeDoc(userDoc.id, userDoc.data()!));
        }
      })
    );

    const requests = page.map((docSnap) => {
      const data = serializeDoc(docSnap.id, docSnap.data());
      data.user = userCache.get(data.user_id as string) ?? null;
      return data;
    });

    return NextResponse.json({ requests, total });
  } catch (error) {
    console.error('GET /api/requests error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // 20 requests created per IP per hour
    const ip = getIp(request);
    if (!rateLimit(`create-request:${ip}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json(
        { message: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as {
      id: string;
      email?: string | null;
      name?: string | null;
      role?: string;
    };

    const body = await request.json();
    const validated = createRequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: validated.error.flatten() },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const now = FieldValue.serverTimestamp();

    // Create the request document
    const requestRef = await db.collection('requests').add({
      user_id: user.id,
      amount: validated.data.amount,
      purpose: validated.data.purpose,
      category: validated.data.category,
      description: validated.data.description ?? null,
      status: 'pending',
      created_at: now,
      updated_at: now,
    });

    const newRequest = serializeDoc(
      requestRef.id,
      (await requestRef.get()).data()!
    );

    // Audit log
    await db.collection('audit_logs').add({
      request_id: requestRef.id,
      action: 'request_created',
      user_id: user.id,
      metadata: {
        amount: validated.data.amount,
        purpose: validated.data.purpose,
      },
      timestamp: now,
    });

    // Notification for the requester
    await db.collection('notifications').add({
      user_id: user.id,
      request_id: requestRef.id,
      title: 'Request Submitted',
      message: `Your request for ${formatCurrency(validated.data.amount)} has been submitted and is pending review.`,
      read: false,
      created_at: now,
    });

    // Send confirmation email (non-blocking)
    if (user.email) {
      sendRequestSubmittedEmail({
        to: user.email,
        requestId: requestRef.id,
        requesterName: user.name || 'User',
        amount: validated.data.amount,
        purpose: validated.data.purpose,
      }).catch(console.error);
    }

    // Notify all admins
    const adminsSnap = await db
      .collection('users')
      .where('role', '==', 'admin')
      .get();

    if (!adminsSnap.empty) {
      const requesterDisplay = escapeHtml(user.name || user.email || 'Unknown');
      const purposeDisplay = escapeHtml(validated.data.purpose);
      for (const adminDoc of adminsSnap.docs) {
        const adminData = adminDoc.data();
        sendAdminNotificationEmail(
          adminData.email as string,
          'New Financial Request',
          `
          <h2 style="color: #1d4ed8;">New Financial Request</h2>
          <p>A new financial request has been submitted and requires your review.</p>
          <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Requester</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${requesterDisplay}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Amount</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${formatCurrency(validated.data.amount)}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Purpose</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${purposeDisplay}</td></tr>
          </table>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/requests/${requestRef.id}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Review Request</a>
          `
        ).catch(console.error);
      }
    }

    return NextResponse.json({ request: newRequest }, { status: 201 });
  } catch (error) {
    console.error('POST /api/requests error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
