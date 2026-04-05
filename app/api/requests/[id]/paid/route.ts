import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
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

    if (existing.status !== 'approved') {
      return NextResponse.json(
        { message: `Only approved requests can be marked as paid. Current status: ${existing.status}` },
        { status: 400 }
      );
    }

    // Update to paid
    const { data: updated, error } = await supabase
      .from('requests')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error marking request as paid:', error);
      return NextResponse.json({ message: 'Failed to mark as paid' }, { status: 500 });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      request_id: params.id,
      action: 'request_paid',
      user_id: user.id,
      metadata: { amount: existing.amount, paid_at: updated.paid_at },
    });

    // Notify requester
    await supabase.from('notifications').insert({
      user_id: existing.user_id,
      request_id: params.id,
      title: 'Payment Processed',
      message: `Your request for ${formatCurrency(existing.amount)} has been paid. Please provide a receipt when available.`,
    });

    return NextResponse.json({ request: updated, message: 'Request marked as paid' });
  } catch (error) {
    console.error('POST /api/requests/[id]/paid error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
