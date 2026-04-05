import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendRequestRejectedEmail } from '@/lib/email';
import { formatCurrency } from '@/lib/utils';
import { z } from 'zod';

const rejectSchema = z.object({
  reason: z.string().min(10, 'Please provide a detailed reason (at least 10 characters)').max(500),
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

    const supabase = createAdminClient();

    // Fetch the request
    const { data: existing, error: fetchError } = await supabase
      .from('requests')
      .select('*, user:users(id, name, email)')
      .eq('id', params.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ message: 'Request not found' }, { status: 404 });
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { message: `Cannot reject a request with status: ${existing.status}` },
        { status: 400 }
      );
    }

    // Update to rejected
    const { data: updated, error } = await supabase
      .from('requests')
      .update({
        status: 'rejected',
        rejection_reason: validated.data.reason,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error rejecting request:', error);
      return NextResponse.json({ message: 'Failed to reject request' }, { status: 500 });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      request_id: params.id,
      action: 'request_rejected',
      user_id: user.id,
      metadata: { reason: validated.data.reason, previous_status: 'pending' },
    });

    // Notify requester
    await supabase.from('notifications').insert({
      user_id: existing.user_id,
      request_id: params.id,
      title: 'Request Rejected',
      message: `Your request for ${formatCurrency(existing.amount)} has been rejected. Reason: ${validated.data.reason}`,
    });

    // Send email (non-blocking)
    if (existing.user?.email) {
      sendRequestRejectedEmail({
        to: existing.user.email,
        requestId: params.id,
        requesterName: existing.user.name || 'User',
        amount: existing.amount,
        purpose: existing.purpose,
        reason: validated.data.reason,
      }).catch(console.error);
    }

    return NextResponse.json({ request: updated, message: 'Request rejected' });
  } catch (error) {
    console.error('POST /api/requests/[id]/reject error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
