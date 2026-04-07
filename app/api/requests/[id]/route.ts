import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { auth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { serializeDoc } from '@/lib/firestore';
import { z } from 'zod';

const updateRequestSchema = z.object({
  amount: z.number().positive().optional(),
  purpose: z.string().min(5).max(200).optional(),
  category: z.enum(['travel', 'supplies', 'events', 'utilities', 'personnel', 'other']).optional(),
  description: z.string().max(1000).optional().nullable(),
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as { id: string; role?: string };
    const db = getAdminDb();

    const reqDoc = await db.collection('requests').doc(params.id).get();
    if (!reqDoc.exists) {
      return NextResponse.json({ message: 'Request not found' }, { status: 404 });
    }

    const reqData = reqDoc.data()!;

    // Non-admins can only see their own requests
    if (user.role !== 'admin' && reqData.user_id !== user.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // Fetch related data in parallel.
    // request_documents: no orderBy to avoid composite index requirement — sort in JS.
    const [userDoc, docsSnap, receiptSnap] = await Promise.all([
      db.collection('users').doc(reqData.user_id as string).get(),
      db
        .collection('request_documents')
        .where('request_id', '==', params.id)
        .get(),
      db
        .collection('receipts')
        .where('request_id', '==', params.id)
        .limit(1)
        .get(),
    ]);

    const req = serializeDoc(reqDoc.id, reqData);
    req.user = userDoc.exists ? serializeDoc(userDoc.id, userDoc.data()!) : null;

    // Sort documents by uploaded_at ascending in JS
    const rawDocs = docsSnap.docs.map((d) => serializeDoc(d.id, d.data()));
    rawDocs.sort((a, b) => {
      const aTime = typeof a.uploaded_at === 'string' ? a.uploaded_at : '';
      const bTime = typeof b.uploaded_at === 'string' ? b.uploaded_at : '';
      return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
    });
    req.documents = rawDocs;

    req.receipt = receiptSnap.empty
      ? null
      : serializeDoc(receiptSnap.docs[0].id, receiptSnap.docs[0].data());

    return NextResponse.json({ request: req });
  } catch (error) {
    console.error('GET /api/requests/[id] error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as { id: string; role?: string };
    const db = getAdminDb();

    const reqDoc = await db.collection('requests').doc(params.id).get();
    if (!reqDoc.exists) {
      return NextResponse.json({ message: 'Request not found' }, { status: 404 });
    }

    const existing = reqDoc.data()!;

    // Requesters can only update their own pending requests
    if (user.role !== 'admin') {
      if (existing.user_id !== user.id) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }
      if (existing.status !== 'pending') {
        return NextResponse.json(
          { message: 'Only pending requests can be edited' },
          { status: 400 }
        );
      }
    }

    const body = await request.json();
    const validated = updateRequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: validated.error.flatten() },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {
      ...validated.data,
      updated_at: FieldValue.serverTimestamp(),
    };

    await db.collection('requests').doc(params.id).update(updates);

    const updatedDoc = await db.collection('requests').doc(params.id).get();
    const updated = serializeDoc(updatedDoc.id, updatedDoc.data()!);

    // Audit log
    await db.collection('audit_logs').add({
      request_id: params.id,
      action: 'request_updated',
      user_id: user.id,
      metadata: validated.data,
      timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    console.error('PATCH /api/requests/[id] error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as { id: string; role?: string };
    const db = getAdminDb();

    const reqDoc = await db.collection('requests').doc(params.id).get();
    if (!reqDoc.exists) {
      return NextResponse.json({ message: 'Request not found' }, { status: 404 });
    }

    const existing = reqDoc.data()!;

    // Only requesters can delete their own pending requests; admins can delete any
    if (user.role !== 'admin') {
      if (existing.user_id !== user.id || existing.status !== 'pending') {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }
    }

    // Delete related documents in parallel (Firestore has no cascading deletes)
    const [docsSnap, receiptSnap, notifSnap, auditSnap] = await Promise.all([
      db.collection('request_documents').where('request_id', '==', params.id).get(),
      db.collection('receipts').where('request_id', '==', params.id).get(),
      db.collection('notifications').where('request_id', '==', params.id).get(),
      db.collection('audit_logs').where('request_id', '==', params.id).get(),
    ]);

    const batch = db.batch();
    [...docsSnap.docs, ...receiptSnap.docs, ...notifSnap.docs, ...auditSnap.docs].forEach((d) =>
      batch.delete(d.ref)
    );
    batch.delete(db.collection('requests').doc(params.id));
    await batch.commit();

    return NextResponse.json({ message: 'Request deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/requests/[id] error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
