import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
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
    const supabase = createAdminClient();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('requests')
      .select('*, user:users(id, name, email, department)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Non-admins can only see their own requests
    if (user.role !== 'admin') {
      query = query.eq('user_id', user.id);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: requests, error, count } = await query;

    if (error) {
      console.error('Error fetching requests:', error);
      return NextResponse.json({ message: 'Failed to fetch requests' }, { status: 500 });
    }

    return NextResponse.json({ requests, total: count });
  } catch (error) {
    console.error('GET /api/requests error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // 20 requests created per user per hour
    const ip = getIp(request);
    if (!rateLimit(`create-request:${ip}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json({ message: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as { id: string; email?: string | null; name?: string | null; role?: string };

    const body = await request.json();
    const validated = createRequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: validated.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Create the request
    const { data: newRequest, error } = await supabase
      .from('requests')
      .insert({
        user_id: user.id,
        amount: validated.data.amount,
        purpose: validated.data.purpose,
        category: validated.data.category,
        description: validated.data.description || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating request:', error);
      return NextResponse.json({ message: 'Failed to create request' }, { status: 500 });
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      request_id: newRequest.id,
      action: 'request_created',
      user_id: user.id,
      metadata: { amount: validated.data.amount, purpose: validated.data.purpose },
    });

    // Create notification for the user
    await supabase.from('notifications').insert({
      user_id: user.id,
      request_id: newRequest.id,
      title: 'Request Submitted',
      message: `Your request for ${formatCurrency(validated.data.amount)} has been submitted and is pending review.`,
    });

    // Send emails (non-blocking)
    if (user.email) {
      sendRequestSubmittedEmail({
        to: user.email,
        requestId: newRequest.id,
        requesterName: user.name || 'User',
        amount: validated.data.amount,
        purpose: validated.data.purpose,
      }).catch(console.error);
    }

    // Notify admins
    const { data: admins } = await supabase
      .from('users')
      .select('email, name')
      .eq('role', 'admin');

    if (admins && admins.length > 0) {
      const requesterDisplay = escapeHtml(user.name || user.email || 'Unknown');
      const purposeDisplay = escapeHtml(validated.data.purpose);
      for (const admin of admins) {
        sendAdminNotificationEmail(
          admin.email,
          'New Financial Request',
          `
          <h2 style="color: #1d4ed8;">New Financial Request</h2>
          <p>A new financial request has been submitted and requires your review.</p>
          <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Requester</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${requesterDisplay}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Amount</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${formatCurrency(validated.data.amount)}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Purpose</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${purposeDisplay}</td></tr>
          </table>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/requests/${newRequest.id}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Review Request</a>
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
