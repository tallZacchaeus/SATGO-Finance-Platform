import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { serializeDoc } from '@/lib/firestore';
import { format } from 'date-fns';

export async function GET(request: Request) {
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
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let q: FirebaseFirestore.Query = db
      .collection('requests')
      .orderBy('created_at', 'desc');

    // Date range filters (requires composite index on created_at)
    if (from) {
      q = q.where('created_at', '>=', new Date(from));
    }
    if (to) {
      q = q.where('created_at', '<=', new Date(to));
    }

    const snap = await q.get();

    // Apply status filter in-memory
    let docs = snap.docs;
    if (status && status !== 'all') {
      docs = docs.filter((d) => d.data().status === status);
    }

    // Batch-fetch unique user profiles
    const userIds = [...new Set(docs.map((d) => d.data().user_id as string).filter(Boolean))];
    const userCache = new Map<string, Record<string, unknown>>();
    await Promise.all(
      userIds.map(async (uid) => {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
          userCache.set(uid, serializeDoc(userDoc.id, userDoc.data()!));
        }
      })
    );

    const requests = docs.map((docSnap) => {
      const data = serializeDoc(docSnap.id, docSnap.data());
      data.user = userCache.get(data.user_id as string) ?? null;
      return data;
    });

    // Build CSV
    const headers = [
      'Request ID',
      'Requester Name',
      'Requester Email',
      'Department',
      'Amount (NGN)',
      'Purpose',
      'Category',
      'Description',
      'Status',
      'Submitted At',
      'Reviewed At',
      'Paid At',
      'Rejection Reason',
    ];

    const rows = requests.map((req) => {
      const u = req.user as Record<string, unknown> | null;
      return [
        req.id,
        u?.name || '',
        u?.email || '',
        u?.department || '',
        req.amount?.toString() || '0',
        `"${String(req.purpose || '').replace(/"/g, '""')}"`,
        req.category || '',
        `"${String(req.description || '').replace(/"/g, '""')}"`,
        req.status || '',
        req.created_at
          ? format(new Date(req.created_at as string), 'yyyy-MM-dd HH:mm:ss')
          : '',
        req.reviewed_at
          ? format(new Date(req.reviewed_at as string), 'yyyy-MM-dd HH:mm:ss')
          : '',
        req.paid_at
          ? format(new Date(req.paid_at as string), 'yyyy-MM-dd HH:mm:ss')
          : '',
        `"${String(req.rejection_reason || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const filename = `satgo-requests-${format(new Date(), 'yyyy-MM-dd')}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('GET /api/export error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
