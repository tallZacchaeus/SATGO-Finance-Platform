import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { serializeDoc } from '@/lib/firestore';
import { Request } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { RequestTable } from '@/components/requests/request-table';
import { StatCard } from '@/components/ui/card';
import { Card } from '@/components/ui/card';
import {
  ClipboardList,
  Clock,
  CheckCircle,
  DollarSign,
  TrendingUp,
  Download,
  Users,
} from 'lucide-react';

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = session.user as { id: string; role?: string };
  if (user.role !== 'admin') redirect('/requester');

  const db = getAdminDb();

  // Fetch all requests ordered by created_at
  const requestsSnap = await db
    .collection('requests')
    .orderBy('created_at', 'desc')
    .get();

  // Batch-fetch unique user profiles
  const userIds = [
    ...new Set(
      requestsSnap.docs.map((d) => d.data().user_id as string).filter(Boolean)
    ),
  ];
  const userCache = new Map<string, Record<string, unknown>>();
  await Promise.all(
    userIds.map(async (uid) => {
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        userCache.set(uid, serializeDoc(userDoc.id, userDoc.data()!));
      }
    })
  );

  const requests = requestsSnap.docs.map((docSnap) => {
    const data = serializeDoc(docSnap.id, docSnap.data());
    data.user = userCache.get(data.user_id as string) ?? null;
    return data;
  }) as unknown as Request[];

  // Fetch requester count
  const usersSnap = await db
    .collection('users')
    .where('role', '==', 'requester')
    .get();

  const safeRequests = requests || [];

  const stats = {
    total: safeRequests.length,
    pending: safeRequests.filter((r) => r.status === 'pending').length,
    approved: safeRequests.filter((r) =>
      ['approved', 'paid', 'completed'].includes(r.status)
    ).length,
    completed: safeRequests.filter((r) => r.status === 'completed').length,
    totalPending: safeRequests
      .filter((r) => r.status === 'pending')
      .reduce((sum, r) => sum + r.amount, 0),
    totalApproved: safeRequests
      .filter((r) => ['approved', 'paid', 'completed'].includes(r.status))
      .reduce((sum, r) => sum + r.amount, 0),
  };

  const recentPending = safeRequests.filter((r) => r.status === 'pending').slice(0, 5);

  return (
    <div>
      <Header title="Admin Dashboard" userId={user.id} />

      <div className="p-6 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Requests"
            value={stats.total}
            icon={<ClipboardList className="w-5 h-5" />}
            color="blue"
          />
          <StatCard
            title="Pending Review"
            value={stats.pending}
            icon={<Clock className="w-5 h-5" />}
            color="yellow"
          />
          <StatCard
            title="Approved"
            value={stats.approved}
            icon={<CheckCircle className="w-5 h-5" />}
            color="green"
          />
          <StatCard
            title="Total Users"
            value={usersSnap.size}
            icon={<Users className="w-5 h-5" />}
            color="purple"
          />
        </div>

        {/* Financial overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-500">Pending Funds Requested</p>
              <DollarSign className="w-4 h-4 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(stats.totalPending)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Awaiting your review</p>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-500">Total Approved</p>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(stats.totalApproved)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Across all approved requests</p>
          </Card>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/api/export"
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Link>
        </div>

        {/* Pending requests requiring action */}
        {recentPending.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Pending Review</h2>
              <Link
                href="/admin/requests"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all
              </Link>
            </div>
            <RequestTable
              requests={recentPending}
              showRequester={true}
              linkBase="/admin/requests"
            />
          </div>
        )}

        {/* All recent requests */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Requests</h2>
            <Link
              href="/admin/requests"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View all
            </Link>
          </div>
          {safeRequests.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No requests have been submitted yet.</p>
            </div>
          ) : (
            <RequestTable
              requests={safeRequests.slice(0, 10)}
              showRequester={true}
              linkBase="/admin/requests"
            />
          )}
        </div>
      </div>
    </div>
  );
}
