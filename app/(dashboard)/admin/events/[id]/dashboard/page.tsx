import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth, toFrontendRole } from '@/lib/auth';
import { serverApi } from '@/lib/api-server';
import { format } from 'date-fns';
import { CalendarDays, MapPin, Users, TrendingUp, Clock, CheckCircle, FileSpreadsheet, ClipboardList } from 'lucide-react';
import { StaggerList, StaggerItem } from '@/components/ui/animate-in';
import { StatCard } from '@/components/ui/stat-card';
import { NairaAmount } from '@/components/ui/naira-amount';
import { StatusBadge } from '@/components/ui/status-badge';
import { GoldButton } from '@/components/ui/gold-button';
import { AnimatedProgressBar } from '@/components/ui/animated-progress-bar';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EventDashboardPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  const role = toFrontendRole(session.user.role);
  if (role !== 'admin') redirect('/my-requests');

  const eventId = Number(id);
  if (isNaN(eventId)) notFound();

  const [eventRes, budgetsRes, requestsRes] = await Promise.allSettled([
    serverApi.events.get(eventId),
    serverApi.budgets.list(eventId),
    serverApi.requests.list({ event_id: eventId, per_page: 500 }),
  ]);

  const event    = eventRes.status    === 'fulfilled' ? eventRes.value?.data    : null;
  if (!event) notFound();

  const budgets  = budgetsRes.status  === 'fulfilled' ? (budgetsRes.value?.data  ?? []) : [];
  const requests = requestsRes.status === 'fulfilled' ? (requestsRes.value?.data ?? []) : [];

  const totalAllocated  = budgets.reduce((s, b) => s + b.allocated,  0);
  const totalSpent      = budgets.reduce((s, b) => s + b.spent,      0);
  const totalRemaining  = budgets.reduce((s, b) => s + b.remaining,  0);
  const pendingRequests  = requests.filter(r => ['submitted','finance_reviewed'].includes(r.status));
  const approvedRequests = requests.filter(r => ['satgo_approved','partial_payment','paid','receipted','completed'].includes(r.status));
  const spentPct = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

  return (
    <div className="p-5 sm:p-7 space-y-7">
      {/* Event header */}
      <div className="relative rounded-2xl overflow-hidden p-6 bg-[#13093B] border border-[#2D1A73]">
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div>
              <h1 className="font-display text-2xl text-[#F5E8D3]">{event.name}</h1>
              {event.description && (
                <p className="font-body text-sm text-[#A89FB8] mt-1">{event.description}</p>
              )}
            </div>
            {event.status && <StatusBadge status={event.status} />}
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 font-body text-sm text-[#A89FB8]">
              <CalendarDays className="w-4 h-4 shrink-0" />
              {format(new Date(event.event_date), 'dd MMMM yyyy')}
            </div>
            {event.venue && (
              <div className="flex items-center gap-2 font-body text-sm text-[#A89FB8]">
                <MapPin className="w-4 h-4 shrink-0" />
                {event.venue}
              </div>
            )}
            {event.expected_attendance != null && event.expected_attendance > 0 && (
              <div className="flex items-center gap-2 font-body text-sm text-[#A89FB8]">
                <Users className="w-4 h-4 shrink-0" />
                {event.expected_attendance.toLocaleString()} expected
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Budget summary cards */}
      <StaggerList className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StaggerItem>
          <StatCard title="Total Budget"  value={event.total_budget} icon={<TrendingUp   className="w-4 h-4" />} accentColor="#D4A843"
            format="currency-compact" />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Allocated"     value={totalAllocated}     icon={<ClipboardList className="w-4 h-4" />} accentColor="#60A5FA"
            format="currency-compact" />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Spent"         value={totalSpent}         icon={<TrendingUp   className="w-4 h-4" />} accentColor="#FBBF24"
            format="currency-compact" />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Remaining"     value={totalRemaining}     icon={<CheckCircle  className="w-4 h-4" />} accentColor="#34D399"
            format="currency-compact" />
        </StaggerItem>
      </StaggerList>

      {/* Overall utilisation bar */}
      <div className="rounded-xl p-5 bg-[#13093B] border border-[#2D1A73]">
        <div className="flex items-center justify-between mb-3">
          <p className="font-body text-sm text-[#A89FB8]">Overall Budget Utilisation</p>
          <p className="font-display text-base text-[#F5E8D3]">{Math.round(spentPct)}%</p>
        </div>
        <AnimatedProgressBar value={spentPct} />
        <div className="flex justify-between mt-2">
          <NairaAmount amount={totalSpent} compact className="text-xs text-[#A89FB8]" />
          <NairaAmount amount={totalAllocated} compact className="text-xs text-[#A89FB8]" />
        </div>
      </div>

      {/* Two-column: dept budgets + request stats */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Department budgets */}
        <div className="xl:col-span-2">
          <h2 className="font-display text-lg text-[#F5E8D3] mb-4">Department Budgets</h2>
          {budgets.length === 0 ? (
            <div className="rounded-xl p-8 border border-[#2D1A73] bg-[#13093B] text-center font-body text-sm text-[#A89FB8]">
              No budget allocations yet.
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden border border-[#2D1A73]">
              {budgets.map((budget, i) => {
                const pct = budget.percentage_used ?? 0;
                return (
                  <div key={budget.id} className="p-4 border-b border-[#1A0F4D] last:border-0">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-body text-sm font-medium text-[#A89FB8]">{budget.department.name}</p>
                      <div className="flex items-center gap-3">
                        <span className="font-body text-xs text-[#A89FB8]">
                          {Math.round(pct)}% used
                        </span>
                        <NairaAmount amount={budget.remaining} compact className="text-xs text-[#A89FB8]" />
                      </div>
                    </div>
                    <AnimatedProgressBar value={pct} />
                    <div className="flex justify-between mt-1.5">
                      <NairaAmount amount={budget.spent} compact className="text-xs text-[#A89FB8]" />
                      <NairaAmount amount={budget.allocated} compact className="text-xs text-[#A89FB8]" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Request stats + actions */}
        <div className="space-y-4">
          <h2 className="font-display text-lg text-[#F5E8D3]">Requests</h2>

          <div className="rounded-xl p-4 bg-[rgba(251,191,36,0.05)] border border-[rgba(251,191,36,0.15)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-xs text-[#A89FB8]">Pending Review</p>
                <p className="font-display text-2xl text-[#FBBF24] mt-0.5">{pendingRequests.length}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[rgba(251,191,36,0.1)] flex items-center justify-center text-[#FBBF24]">
                <Clock className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="rounded-xl p-4 bg-[rgba(52,211,153,0.05)] border border-[rgba(52,211,153,0.15)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-xs text-[#A89FB8]">Approved</p>
                <p className="font-display text-2xl text-[#34D399] mt-0.5">{approvedRequests.length}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[rgba(52,211,153,0.1)] flex items-center justify-center text-[#34D399]">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Link href={`/admin/requests?event_id=${eventId}`}>
              <GoldButton className="w-full gap-2 text-sm">
                <ClipboardList className="w-4 h-4" />
                View All Requests
              </GoldButton>
            </Link>
            <Link href={`/admin/events/${eventId}/import`}>
              <GoldButton variant="outline" className="w-full gap-2 text-sm mt-2">
                <FileSpreadsheet className="w-4 h-4" />
                Import Budget (Excel)
              </GoldButton>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
