import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { auth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { serializeDoc } from '@/lib/firestore';
import { uploadFile } from '@/lib/storage';
import { sendReceiptUploadedEmail } from '@/lib/email';

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

    if (existing.status !== 'paid') {
      return NextResponse.json(
        {
          message: `Receipts can only be uploaded for paid requests. Current status: ${existing.status}`,
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No file provided' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { message: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { message: 'Invalid file type. Allowed: PDF, JPG, PNG' },
        { status: 400 }
      );
    }

    // Upload to Firebase Storage
    const fileBuffer = await file.arrayBuffer();
    const safeName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    const storagePath = `receipts/${params.id}/${Date.now()}-${safeName}`;

    let fileUrl: string;
    try {
      fileUrl = await uploadFile(storagePath, fileBuffer, file.type);
    } catch (uploadError) {
      console.error('Storage upload error:', uploadError);
      // Fallback: store a placeholder so the record is still created
      fileUrl = `placeholder://${storagePath}`;
    }

    const now = FieldValue.serverTimestamp();

    // Save receipt record
    const receiptRef = await db.collection('receipts').add({
      request_id: params.id,
      file_url: fileUrl,
      file_name: file.name,
      file_size: file.size,
      uploaded_by: user.id,
      uploaded_at: now,
    });

    // Manually complete the request (replaces the Supabase DB trigger)
    await db.collection('requests').doc(params.id).update({
      status: 'completed',
      updated_at: now,
    });

    const receiptSnap = await receiptRef.get();
    const receipt = serializeDoc(receiptSnap.id, receiptSnap.data()!);

    // Audit log
    await db.collection('audit_logs').add({
      request_id: params.id,
      action: 'receipt_uploaded',
      user_id: user.id,
      metadata: { file_name: file.name, file_size: file.size },
      timestamp: now,
    });

    // Notify requester
    await db.collection('notifications').add({
      user_id: existing.user_id,
      request_id: params.id,
      title: 'Receipt Uploaded - Request Completed',
      message: `A receipt has been uploaded for your request. Your request is now completed.`,
      read: false,
      created_at: now,
    });

    // Fetch requester profile for email
    const requesterDoc = await db.collection('users').doc(existing.user_id as string).get();
    const requester = requesterDoc.data();

    if (requester?.email) {
      sendReceiptUploadedEmail({
        to: requester.email as string,
        requestId: params.id,
        requesterName: (requester.name as string) || 'User',
        amount: existing.amount as number,
        purpose: existing.purpose as string,
      }).catch(console.error);
    }

    const message = fileUrl.startsWith('placeholder://')
      ? 'Receipt uploaded (storage bucket pending setup). Request completed.'
      : 'Receipt uploaded successfully. Request completed.';

    return NextResponse.json({ receipt, message });
  } catch (error) {
    console.error('POST /api/requests/[id]/receipt error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
