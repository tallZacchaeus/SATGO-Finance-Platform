'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft, FileText, CheckCircle, XCircle, AlertCircle,
  Loader2, Clock, ThumbsUp, DollarSign, Package, User, Upload,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FinanceRequest } from '@/lib/api-client';
import { api, ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { NairaAmount } from '@/components/ui/naira-amount';
import { GoldButton } from '@/components/ui/gold-button';

/* ── Status Timeline (shared shape, duplicated here for independence) */

type TimelineStep = {
  key:    string;
  label:  string;
  icon:   React.ReactNode;
  actor?: string;
  at?:    string | null;
  done:   boolean;
  active: boolean;
};

function StatusTimeline({ request }: { request: FinanceRequest }) {
  const steps: TimelineStep[] = [
    {
      key: 'submitted', label: 'Submitted', icon: <Clock className="w-3.5 h-3.5" />,
      actor: request.requester?.name, at: request.created_at, done: true, active: true,
    },
    {
      key: 'finance_reviewed', label: 'Finance Reviewed', icon: <ThumbsUp className="w-3.5 h-3.5" />,
      actor: request.finance_reviewed_by?.name, at: request.finance_reviewed_at,
      done: !!request.finance_reviewed_at,
      active: ['finance_reviewed','satgo_approved','partial_payment','paid','receipted','completed'].includes(request.status),
    },
    {
      key: 'satgo_approved', label: 'SATGO Approved', icon: <CheckCircle className="w-3.5 h-3.5" />,
      actor: request.satgo_approved_by?.name, at: request.satgo_approved_at,
      done: !!request.satgo_approved_at,
      active: ['satgo_approved','partial_payment','paid','receipted','completed'].includes(request.status),
    },
    {
      key: 'paid', label: 'Paid', icon: <DollarSign className="w-3.5 h-3.5" />,
      actor: request.paid_confirmed_by?.name, at: request.fully_paid_at,
      done: !!request.fully_paid_at,
      active: ['paid','receipted','completed'].includes(request.status),
    },
    {
      key: 'completed', label: 'Completed', icon: <CheckCircle className="w-3.5 h-3.5" />,
      at: request.completed_at, done: !!request.completed_at,
      active: request.status === 'completed',
    },
  ];

  if (request.status === 'finance_rejected' || request.status === 'satgo_rejected') {
    return (
      <div className="rounded-xl p-4 bg-[rgba(248,113,113,0.06)] border border-[rgba(248,113,113,0.18)]">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-[rgba(248,113,113,0.15)] flex items-center justify-center shrink-0 text-[#F87171]">
            <XCircle className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="font-body text-sm font-semibold text-[#F87171]">Rejected</p>
            {request.rejected_by?.name && (
              <p className="font-body text-xs text-[#A89FB8] mt-0.5">by {request.rejected_by.name}</p>
            )}
            {request.rejected_at && (
              <p className="font-body text-xs text-[#A89FB8] mt-0.5">{formatDateTime(request.rejected_at)}</p>
            )}
            {request.rejection_reason && (
              <p className="font-body text-xs text-[rgba(248,113,113,0.75)] mt-2 leading-relaxed">{request.rejection_reason}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <div key={step.key} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={[
              'w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors',
              step.done
                ? 'bg-[rgba(52,211,153,0.15)] text-[#34D399] border border-[rgba(52,211,153,0.25)]'
                : step.active
                  ? 'bg-[#1A0F4D] text-[#D4A843] border border-[#1A0F4D]'
                  : 'bg-[#1A0F4D] text-[#A89FB8] border border-[#2D1A73]',
            ].join(' ')}>
              {step.icon}
            </div>
            {i < steps.length - 1 && (
              <div className={[
                'w-px flex-1 my-1 min-h-[20px]',
                step.done ? 'bg-[rgba(52,211,153,0.2)]' : 'bg-[#2D1A73]',
              ].join(' ')} />
            )}
          </div>
          <div className="pb-4 flex-1 min-w-0">
            <p className={[
              'font-body text-sm font-medium',
              step.done ? 'text-[#A89FB8]' : step.active ? 'text-[#D4A843]' : 'text-[#A89FB8]',
            ].join(' ')}>
              {step.label}
            </p>
            {step.actor && (
              <p className="font-body text-xs text-[#A89FB8] mt-0.5">{step.actor}</p>
            )}
            {step.at && (
              <p className="font-body text-xs text-[#A89FB8] mt-0.5">{formatDateTime(step.at)}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Dark Modal ──────────────────────────────────────────────────── */

function DarkModal({
  isOpen, onClose, title, children,
}: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[rgba(8,14,24,0.8)] backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-md rounded-2xl bg-[#13093B] border border-[#2D1A73] p-6 shadow-2xl"
          >
            <h3 className="font-display text-lg text-[#F5E8D3] mb-4">{title}</h3>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function AdminRequestDetail() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [request,     setRequest]     = useState<FinanceRequest | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [fetchError,  setFetchError]  = useState<{ status: number; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [showRejectModal,  setShowRejectModal]  = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [rejectionReason,  setRejectionReason]  = useState('');
  const [receiptFile,      setReceiptFile]      = useState<File | null>(null);
  const [amountPaid,       setAmountPaid]       = useState('');

  const fetchRequest = useCallback(async () => {
    try {
      const res = await api.financeRequests.get(Number(id));
      setRequest(res.data);
      setFetchError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setFetchError({ status: err.status, message: err.message });
      } else {
        setFetchError({ status: 0, message: 'Network error — could not reach the server.' });
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchRequest(); }, [fetchRequest]);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await api.financeRequests.satgoApprove(Number(id), '');
      toast.success('Request approved');
      fetchRequest();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to approve');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { toast.error('Please provide a rejection reason'); return; }
    setIsProcessing(true);
    try {
      await api.financeRequests.satgoReject(Number(id), rejectionReason, 'other');
      toast.success('Request rejected');
      setShowRejectModal(false);
      setRejectionReason('');
      fetchRequest();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to reject');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkPaid = async () => {
    setIsProcessing(true);
    try {
      await api.financeRequests.recordPayment(Number(id), {
        amount_kobo: request!.amount_kobo,
        payment_date: new Date().toISOString().split('T')[0],
      });
      toast.success('Request marked as paid');
      fetchRequest();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to mark as paid');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReceiptUpload = async () => {
    if (!receiptFile) { toast.error('Please select a file'); return; }
    const amountKobo = Math.round(Number(amountPaid) * 100);
    if (!amountKobo || amountKobo <= 0) { toast.error('Please enter the amount paid'); return; }
    setIsProcessing(true);
    try {
      await api.financeRequests.uploadReceipt(Number(id), receiptFile, amountKobo);
      toast.success('Receipt uploaded — request completed!');
      setShowReceiptModal(false);
      setReceiptFile(null);
      setAmountPaid('');
      fetchRequest();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to upload receipt');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-[#D4A843]" />
      </div>
    );
  }

  if (fetchError || !request) {
    const is404 = fetchError?.status === 404;
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-10 h-10 text-[#F87171] mx-auto mb-3" />
        <p className="font-body font-semibold text-[#A89FB8] mb-1">
          {is404 ? 'Request not found' : 'Could not load request'}
        </p>
        <p className="font-body text-sm text-[#A89FB8] mb-4">
          {fetchError?.message ?? 'An unexpected error occurred.'}
        </p>
        <Link href="/admin" className="font-body text-sm text-[#D4A843] hover:opacity-80">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const can     = request.can;
  const receipt = request.receipts?.[0];

  return (
    <div className="p-5 sm:p-7 max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 font-body text-sm text-[#A89FB8] hover:text-[#A89FB8] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1 className="font-display text-2xl text-[#F5E8D3]">{request.title}</h1>
          <p className="font-mono text-xs text-[#D4A843] mt-1">{request.reference}</p>
        </div>
        <StatusBadge status={request.status} />
      </motion.div>

      {/* Two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="lg:col-span-2 space-y-5"
        >
          {/* Amount card */}
          <div className="rounded-xl p-5 bg-[#1F1450] border border-[#1A0F4D]">
            <p className="font-body text-xs text-[#D4A843] uppercase tracking-wider mb-1">Total Amount</p>
            <NairaAmount amount={request.amount} animated className="text-4xl" />
            <p className="font-body text-xs text-[#A89FB8] mt-2">
              {request.quantity} × <NairaAmount amount={request.unit_cost} className="text-xs inline" /> per unit
            </p>
          </div>

          {/* Details */}
          <div className="rounded-xl p-5 bg-[#13093B] border border-[#2D1A73] space-y-4">
            <h2 className="font-display text-base text-[#F5E8D3]">Request Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#1A0F4D] flex items-center justify-center shrink-0 text-[#A89FB8]">
                  <Package className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="font-body text-xs text-[#A89FB8]">Type</p>
                  <p className="font-body text-sm text-[#A89FB8] mt-0.5">
                    {request.request_type?.name ?? '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#1A0F4D] flex items-center justify-center shrink-0 text-[#A89FB8]">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="font-body text-xs text-[#A89FB8]">Requester</p>
                  <p className="font-body text-sm text-[#A89FB8] mt-0.5">{request.requester?.name ?? '—'}</p>
                  <p className="font-body text-xs text-[#A89FB8]">{request.department?.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#1A0F4D] flex items-center justify-center shrink-0 text-[#A89FB8]">
                  <CheckCircle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="font-body text-xs text-[#A89FB8]">Event</p>
                  <p className="font-body text-sm text-[#A89FB8] mt-0.5">{request.event?.name ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#1A0F4D] flex items-center justify-center shrink-0 text-[#A89FB8]">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="font-body text-xs text-[#A89FB8]">Submitted</p>
                  <p className="font-body text-sm text-[#A89FB8] mt-0.5">{formatDateTime(request.created_at)}</p>
                </div>
              </div>
            </div>

            {request.description && (
              <div className="pt-4 border-t border-[#1A0F4D]">
                <p className="font-body text-xs text-[#A89FB8] mb-2">Additional details</p>
                <p className="font-body text-sm text-[#A89FB8] leading-relaxed whitespace-pre-line">{request.description}</p>
              </div>
            )}
          </div>

          {/* Documents */}
          {request.documents && request.documents.length > 0 && (
            <div className="rounded-xl p-5 bg-[#13093B] border border-[#2D1A73]">
              <h2 className="font-display text-base text-[#F5E8D3] mb-3">Supporting Documents</h2>
              <div className="space-y-2">
                {request.documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#2D1A73] bg-[#13093B] hover:border-[#1A0F4D] hover:bg-[#1F1450] transition-all group"
                  >
                    <FileText className="w-4 h-4 text-[#A89FB8] group-hover:text-[#D4A843] shrink-0 transition-colors" />
                    <span className="font-body text-sm text-[#A89FB8] group-hover:text-[#A89FB8] truncate transition-colors">{doc.file_name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Receipt */}
          {receipt && (
            <div className="rounded-xl p-5 bg-[rgba(52,211,153,0.04)] border border-[rgba(52,211,153,0.15)]">
              <h2 className="font-display text-base text-[#F5E8D3] mb-3">Receipt</h2>
              <a
                href={receipt.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[rgba(52,211,153,0.2)] bg-[rgba(52,211,153,0.05)] hover:bg-[rgba(52,211,153,0.1)] transition-all"
              >
                <CheckCircle className="w-4 h-4 text-[#34D399] shrink-0" />
                <span className="font-body text-sm text-[#A89FB8] truncate flex-1">{receipt.file_name}</span>
                <NairaAmount amount={receipt.amount} compact className="text-sm text-[#34D399] shrink-0" />
              </a>
            </div>
          )}
        </motion.div>

        {/* ── Right column ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="space-y-5"
        >
          {/* Timeline */}
          <div className="rounded-xl p-5 bg-[#13093B] border border-[#2D1A73]">
            <h2 className="font-display text-base text-[#F5E8D3] mb-4">Approval Chain</h2>
            <StatusTimeline request={request} />
          </div>

          {/* Actions panel */}
          {can && (
            <div className="rounded-xl p-5 bg-[#13093B] border border-[#2D1A73] space-y-3">
              <h2 className="font-display text-base text-[#F5E8D3]">Actions</h2>

              {request.status === 'submitted' && !can.satgo_approve && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-[rgba(251,191,36,0.05)] border border-[rgba(251,191,36,0.12)]">
                  <AlertCircle className="w-4 h-4 text-[#FBBF24] shrink-0 mt-0.5" />
                  <p className="font-body text-xs text-[#A89FB8]">
                    Awaiting team lead recommendation.
                  </p>
                </div>
              )}

              {can.satgo_approve && request.status === 'finance_reviewed' && (
                <GoldButton
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="w-full gap-2"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Approve Request
                </GoldButton>
              )}

              {can.record_payment && request.status === 'satgo_approved' && (
                <GoldButton
                  onClick={handleMarkPaid}
                  disabled={isProcessing}
                  className="w-full gap-2"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                  Mark as Paid
                </GoldButton>
              )}

              {can.upload_receipt && request.status === 'paid' && !receipt && (
                <GoldButton
                  variant="outline"
                  onClick={() => setShowReceiptModal(true)}
                  disabled={isProcessing}
                  className="w-full gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload Receipt
                </GoldButton>
              )}

              {can.satgo_reject && ['submitted','finance_reviewed'].includes(request.status) && (
                <GoldButton
                  variant="danger"
                  onClick={() => setShowRejectModal(true)}
                  disabled={isProcessing}
                  className="w-full gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Reject Request
                </GoldButton>
              )}

              {['completed', 'finance_rejected', 'satgo_rejected'].includes(request.status) && (
                <p className="font-body text-xs text-[#A89FB8] text-center py-1">
                  No further actions available.
                </p>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Reject Modal ── */}
      <DarkModal
        isOpen={showRejectModal}
        onClose={() => { setShowRejectModal(false); setRejectionReason(''); }}
        title="Reject Request"
      >
        <p className="font-body text-sm text-[#A89FB8] mb-4">
          Provide a reason for rejecting this request. The requester will be notified.
        </p>
        <textarea
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="Enter rejection reason…"
          rows={4}
          className="input-field resize-none w-full mb-4"
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { setShowRejectModal(false); setRejectionReason(''); }}
            disabled={isProcessing}
            className="flex-1 px-4 py-2.5 rounded-lg font-body text-sm text-[#A89FB8] border border-[#2D1A73] hover:bg-[#1A0F4D] transition-colors"
          >
            Cancel
          </button>
          <GoldButton
            variant="danger"
            onClick={handleReject}
            disabled={isProcessing}
            className="flex-1 gap-2"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Reject
          </GoldButton>
        </div>
      </DarkModal>

      {/* ── Receipt Modal ── */}
      <DarkModal
        isOpen={showReceiptModal}
        onClose={() => { setShowReceiptModal(false); setReceiptFile(null); setAmountPaid(''); }}
        title="Upload Receipt"
      >
        <div className="space-y-4 mb-4">
          <div>
            <label className="block font-body text-xs font-medium text-[#A89FB8] mb-1.5">
              Amount Paid (₦)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="0.00"
              className="input-field w-full"
            />
          </div>

          <label className="block w-full border border-dashed border-[#3D2590] rounded-xl p-6 text-center cursor-pointer hover:border-[#2D1A73] hover:bg-[#1F1450] transition-all group">
            <Upload className="w-6 h-6 text-[#A89FB8] group-hover:text-[#D4A843] mx-auto mb-2 transition-colors" />
            <p className="font-body text-sm text-[#A89FB8] group-hover:text-[#A89FB8] transition-colors">
              {receiptFile ? receiptFile.name : 'Click to select receipt'}
            </p>
            <p className="font-body text-xs text-[#A89FB8] mt-1">PDF, JPG, PNG up to 10MB</p>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { setShowReceiptModal(false); setReceiptFile(null); setAmountPaid(''); }}
            disabled={isProcessing}
            className="flex-1 px-4 py-2.5 rounded-lg font-body text-sm text-[#A89FB8] border border-[#2D1A73] hover:bg-[#1A0F4D] transition-colors"
          >
            Cancel
          </button>
          <GoldButton
            onClick={handleReceiptUpload}
            disabled={isProcessing || !receiptFile || !amountPaid}
            className="flex-1 gap-2"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload
          </GoldButton>
        </div>
      </DarkModal>
    </div>
  );
}
