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
import { PlusCircle, ClipboardList, CheckCircle, Clock, XCircle } from 'lucide-react';

export default async function RequesterDashboard() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = session.user as { id: string; name?: string | null; role?: string };
  if (user.role === 'admin') redirect('/admin');

  const db = getAdminDb();

  const requestsSnap = await db
    .collection('requests')
    .where('user_id', '==', user.id)
    .orderBy('created_at', 'desc')
    .get();

  const requests = requestsSnap.docs.map((docSnap) =>
    serializeDoc(docSnap.id, docSnap.data())
  ) as unknown as Request[];

  const safeRequests = requests || [];

  const stats = {
    total: safeRequests.length,
    pending: safeRequests.filter((r) => r.status === 'pending').length,
    approved: safeRequests.filter((r) =>
      ['approved', 'paid', 'completed'].includes(r.status)
    ).length,
    rejected: safeRequests.filter((r) => r.status === 'rejected').length,
    totalAmount: safeRequests
      .filter((r) => ['approved', 'paid', 'completed'].includes(r.status))
      .reduce((sum, r) => sum + r.amount, 0),
  };

  return (
    <div>
      <Header title="My Requests" userId={user.id} />

      <div className="p-6 space-y-6">
        {/* Welcome banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Welcome back, {user.name?.split(' ')[0] || 'there'}!
              </h2>
              <p className="text-blue-100 mt-1 text-sm">
                Track and manage your financial requests from here.
              </p>
            </div>
            <Link
              href="/requester/new-request"
              className="flex items-center gap-2 bg-white text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              New Request
            </Link>
          </div>
        </div>

        {/* Stats */}
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
            title="Rejected"
            value={stats.rejected}
            icon={<XCircle className="w-5 h-5" />}
            color="red"
          />
        </div>

        {/* Approved total */}
        {stats.totalAmount > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm text-green-700">
              <span className="font-semibold">Total Approved Amount:</span>{' '}
              {formatCurrency(stats.totalAmount)}
            </p>
          </div>
        )}

        {/* Requests table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Request History</h2>
            {safeRequests.length > 0 && (
              <Link
                href="/requester/new-request"
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <PlusCircle className="w-4 h-4" />
                New Request
              </Link>
            )}
          </div>

          {safeRequests.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <ClipboardList className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">No requests yet</h3>
              <p className="text-gray-500 text-sm mb-4">
                Submit your first financial request to get started.
              </p>
              <Link href="/requester/new-request" className="btn-primary inline-flex items-center gap-2">
                <PlusCircle className="w-4 h-4" />
                Submit a Request
              </Link>
            </div>
          ) : (
            <RequestTable
              requests={safeRequests}
              showRequester={false}
              linkBase="/requester/requests"
            />
          )}
        </div>
      </div>
    </div>
  );
}
