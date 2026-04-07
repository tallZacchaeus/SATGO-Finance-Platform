import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { serializeDoc } from '@/lib/firestore';
import { Request, RequestCategory, RequestStatus } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { RequestTable } from '@/components/requests/request-table';
import { StatCard } from '@/components/ui/card';
import { PlusCircle, ClipboardList, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';

const REQUEST_STATUSES: RequestStatus[] = [
  'pending',
  'approved',
  'rejected',
  'paid',
  'completed',
];

const REQUEST_CATEGORIES: RequestCategory[] = [
  'travel',
  'supplies',
  'events',
  'utilities',
  'personnel',
  'other',
];

function getSafeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function getSafeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeRequest(raw: Record<string, unknown>): Request {
  const status = REQUEST_STATUSES.includes(raw.status as RequestStatus)
    ? (raw.status as RequestStatus)
    : 'pending';
  const category = REQUEST_CATEGORIES.includes(raw.category as RequestCategory)
    ? (raw.category as RequestCategory)
    : 'other';

  return {
    id: getSafeString(raw.id, 'unknown-request'),
    user_id: getSafeString(raw.user_id),
    amount: getSafeNumber(raw.amount),
    purpose: getSafeString(raw.purpose, 'Untitled request'),
    category,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    status,
    rejection_reason:
      typeof raw.rejection_reason === 'string' ? raw.rejection_reason : undefined,
    reviewed_by: typeof raw.reviewed_by === 'string' ? raw.reviewed_by : undefined,
    reviewed_at: typeof raw.reviewed_at === 'string' ? raw.reviewed_at : undefined,
    paid_at: typeof raw.paid_at === 'string' ? raw.paid_at : undefined,
    created_at: getSafeString(raw.created_at),
    updated_at: getSafeString(raw.updated_at),
    user:
      raw.user && typeof raw.user === 'object'
        ? (raw.user as Request['user'])
        : undefined,
  };
}

function getFirstName(name: string | null | undefined) {
  if (typeof name !== 'string') {
    return 'there';
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return 'there';
  }

  return trimmedName.split(/\s+/)[0] || 'there';
}

export default async function RequesterDashboard() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = session.user as { id: string; name?: string | null; role?: string };
  const role = user.role === 'admin' ? 'admin' : 'requester';
  if (role === 'admin') redirect('/admin');

  let safeRequests: Request[] = [];
  let loadError: string | null = null;

  try {
    const db = getAdminDb();
    const requestsSnap = await db
      .collection('requests')
      .where('user_id', '==', user.id)
      .orderBy('created_at', 'desc')
      .get();

    safeRequests = requestsSnap.docs.map((docSnap) =>
      normalizeRequest(serializeDoc(docSnap.id, docSnap.data()))
    );
  } catch (error) {
    console.error('RequesterDashboard load error:', error);
    loadError = 'We could not load your requests right now. Please try again shortly.';
  }

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
                Welcome back, {getFirstName(user.name)}!
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

        {loadError && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Requests unavailable</p>
              <p className="text-sm mt-1">{loadError}</p>
            </div>
          </div>
        )}

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
