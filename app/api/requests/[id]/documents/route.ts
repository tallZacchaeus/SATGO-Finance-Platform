import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

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
    const supabase = createAdminClient();

    // Fetch the request to verify ownership and status
    const { data: existing, error: fetchError } = await supabase
      .from('requests')
      .select('id, user_id, status')
      .eq('id', params.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ message: 'Request not found' }, { status: 404 });
    }

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
      return NextResponse.json({ message: 'File too large. Maximum size is 10MB' }, { status: 400 });
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

    // Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const safeName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = `request-documents/${params.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('request-documents')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ message: 'Failed to upload file' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('request-documents').getPublicUrl(filePath);

    // Save document record
    const { data: document, error: dbError } = await supabase
      .from('request_documents')
      .insert({
        request_id: params.id,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        type: docType,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error saving document record:', dbError);
      return NextResponse.json({ message: 'Failed to save document record' }, { status: 500 });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      request_id: params.id,
      action: 'document_uploaded',
      user_id: user.id,
      metadata: { file_name: file.name, file_size: file.size, type: docType },
    });

    return NextResponse.json({ document, message: 'Document uploaded successfully' }, { status: 201 });
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
    const supabase = createAdminClient();

    // Verify access to the parent request
    const { data: existing, error: fetchError } = await supabase
      .from('requests')
      .select('id, user_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ message: 'Request not found' }, { status: 404 });
    }

    if (user.role !== 'admin' && existing.user_id !== user.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { data: documents, error } = await supabase
      .from('request_documents')
      .select('*')
      .eq('request_id', params.id)
      .order('uploaded_at', { ascending: true });

    if (error) {
      return NextResponse.json({ message: 'Failed to fetch documents' }, { status: 500 });
    }

    return NextResponse.json({ documents: documents || [] });
  } catch (error) {
    console.error('GET /api/requests/[id]/documents error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
