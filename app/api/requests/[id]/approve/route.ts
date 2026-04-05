import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
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
        { message: `Cannot approve a request with status: ${existing.status}` },
        { status: 400 }
      );
    }

    // High-value approval gate — require explicit confirmation from the client
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

    // Update to approved
    const { data: updated, error } = await supabase
      .from('requests')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error approving request:', error);
      return NextResponse.json({ message: 'Failed to approve request' }, { status: 500 });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      request_id: params.id,
      action: 'request_approved',
      user_id: user.id,
      metadata: {
        previous_status: 'pending',
        high_value: existing.amount >= APPROVAL_THRESHOLD,
      },
    });

    // Notify the requester
    await supabase.from('notifications').insert({
      user_id: existing.user_id,
      request_id: params.id,
      title: 'Request Approved',
      message: `Your request for ${formatCurrency(existing.amount)} has been approved. Payment will be processed shortly.`,
    });

    // Send email (non-blocking)
    if (existing.user?.email) {
      sendRequestApprovedEmail({
        to: existing.user.email,
        requestId: params.id,
        requesterName: existing.user.name || 'User',
        amount: existing.amount,
        purpose: existing.purpose,
      }).catch(console.error);
    }

    return NextResponse.json({ request: updated, message: 'Request approved successfully' });
  } catch (error) {
    console.error('POST /api/requests/[id]/approve error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
