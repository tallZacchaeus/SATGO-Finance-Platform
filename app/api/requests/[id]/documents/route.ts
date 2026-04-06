import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { auth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { serializeDoc } from '@/lib/firestore';
import { uploadFile } from '@/lib/storage';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

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
    const db = getAdminDb();

    // Fetch the request to verify ownership and status
    const reqDoc = await db.collection('requests').doc(params.id).get();
    if (!reqDoc.exists) {
      return NextResponse.json({ message: 'Request not found' }, { status: 404 });
    }

    const existing = reqDoc.data()!;

    // Only the requester (owner) or an admin can attach documents
    if (user.role !== 'admin' && existing.user_id !== user.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // Requesters can only attach documents while the request is pending
    if (user.role !== 'admin' && existing.status !== 'pending') {
      return NextResponse.json(
        { message: 'Documents can only be added to pending requests' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const docType = (formData.get('type') as string) || 'supporting';

    if (!file) {
      return NextResponse.json({ message: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { message: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { message: 'Invalid file type. Allowed: PDF, JPG, PNG, WEBP' },
        { status: 400 }
      );
    }

    const validDocTypes = ['supporting', 'invoice', 'quote'];
    if (!validDocTypes.includes(docType)) {
      return NextResponse.json(
        { message: 'Invalid document type. Allowed: supporting, invoice, quote' },
        { status: 400 }
      );
    }

    // Upload to Firebase Storage
    const fileBuffer = await file.arrayBuffer();
    const safeName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    const storagePath = `request-documents/${params.id}/${Date.now()}-${safeName}`;

    const fileUrl = await uploadFile(storagePath, fileBuffer, file.type);

    const now = FieldValue.serverTimestamp();

    // Save document record
    const docRef = await db.collection('request_documents').add({
      request_id: params.id,
      file_url: fileUrl,
      file_name: file.name,
      file_size: file.size,
      type: docType,
      uploaded_by: user.id,
      uploaded_at: now,
    });

    const docSnap = await docRef.get();
    const document = serializeDoc(docSnap.id, docSnap.data()!);

    // Audit log
    await db.collection('audit_logs').add({
      request_id: params.id,
      action: 'document_uploaded',
      user_id: user.id,
      metadata: { file_name: file.name, file_size: file.size, type: docType },
      timestamp: now,
    });

    return NextResponse.json(
      { document, message: 'Document uploaded successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/requests/[id]/documents error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

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

    // Verify access to the parent request
    const reqDoc = await db.collection('requests').doc(params.id).get();
    if (!reqDoc.exists) {
      return NextResponse.json({ message: 'Request not found' }, { status: 404 });
    }

    const existing = reqDoc.data()!;

    if (user.role !== 'admin' && existing.user_id !== user.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const docsSnap = await db
      .collection('request_documents')
      .where('request_id', '==', params.id)
      .orderBy('uploaded_at', 'asc')
      .get();

    const documents = docsSnap.docs.map((d) => serializeDoc(d.id, d.data()));

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('GET /api/requests/[id]/documents error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
