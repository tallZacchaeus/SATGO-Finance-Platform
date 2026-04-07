'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  DollarSign,
  Upload,
  FileText,
  Calendar,
  User,
  Tag,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Request } from '@/lib/types';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { StatusBadge } from '@/components/requests/status-badge';
import { Button } from '@/components/ui/button';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Card } from '@/components/ui/card';

export default function AdminRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<Request | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<{ status: number; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modals
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const fetchRequest = useCallback(async () => {
    try {
      const res = await fetch(`/api/requests/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setFetchError({ status: res.status, message: body.message || 'Failed to load request' });
        return;
      }
      const data = await res.json();
      setRequest(data.request);
      setFetchError(null);
    } catch {
      setFetchError({ status: 0, message: 'Network error — could not reach the server.' });
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/requests/${id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to approve request');
      toast.success('Request approved successfully');
      fetchRequest();
    } catch {
      toast.error('Failed to approve request');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason }),
      });
      if (!res.ok) throw new Error('Failed to reject request');
      toast.success('Request rejected');
      setShowRejectModal(false);
      setRejectionReason('');
      fetchRequest();
    } catch {
      toast.error('Failed to reject request');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkPaid = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/requests/${id}/paid`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to mark as paid');
      toast.success('Request marked as paid');
      fetchRequest();
    } catch {
      toast.error('Failed to mark as paid');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReceiptUpload = async () => {
    if (!receiptFile) {
      toast.error('Please select a file');
      return;
    }
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', receiptFile);
      const res = await fetch(`/api/requests/${id}/receipt`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to upload receipt');
      toast.success('Receipt uploaded - request completed!');
      setShowReceiptModal(false);
      setReceiptFile(null);
      fetchRequest();
    } catch {
      toast.error('Failed to upload receipt');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (fetchError || !request) {
    const is404 = fetchError?.status === 404;
    return (
      <div className="p-4 sm:p-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="font-semibold text-gray-800 mb-1">
          {is404 ? 'Request not found' : 'Could not load request'}
        </p>
        <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
          {fetchError?.message ?? 'An unexpected error occurred.'}
          {!is404 && fetchError?.status === 0
            ? ''
            : !is404
            ? ` (HTTP ${fetchError?.status})`
            : ''}
        </p>
        <Link href="/admin" className="text-blue-600 text-sm hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Back + header */}
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{request.purpose}</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Request #{request.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <StatusBadge status={request.status} className="text-sm px-3 py-1" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Amount card */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
            <p className="text-sm font-medium text-blue-600 mb-1">Requested Amount</p>
            <p className="text-4xl font-bold text-gray-900">{formatCurrency(request.amount)}</p>
          </Card>

          {/* Details */}
          <Card>
            <h2 className="font-semibold text-gray-900 mb-4">Request Details</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Tag className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Category</p>
                  <p className="text-sm font-medium text-gray-700 capitalize">{request.category}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Submitted</p>
                  <p className="text-sm font-medium text-gray-700">
                    {formatDateTime(request.created_at)}
                  </p>
                </div>
              </div>
              {request.reviewed_at && (
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Reviewed</p>
                    <p className="text-sm font-medium text-gray-700">
                      {formatDateTime(request.reviewed_at)}
                    </p>
                  </div>
                </div>
              )}
              {request.paid_at && (
                <div className="flex items-start gap-3">
                  <DollarSign className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Paid</p>
                    <p className="text-sm font-medium text-gray-700">
                      {formatDateTime(request.paid_at)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {request.description && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Additional Details</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{request.description}</p>
              </div>
            )}
          </Card>

          {/* Rejection reason */}
          {request.status === 'rejected' && request.rejection_reason && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start gap-2">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800 text-sm">Rejection Reason</p>
                  <p className="text-sm text-red-700 mt-1">{request.rejection_reason}</p>
                </div>
              </div>
            </div>
          )}

          {/* Documents */}
          {request.documents && request.documents.length > 0 && (
            <Card>
              <h2 className="font-semibold text-gray-900 mb-3">Supporting Documents</h2>
              <div className="space-y-2">
                {request.documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-blue-600 hover:text-blue-700 truncate">
                      {doc.file_name}
                    </span>
                    <span className="ml-auto text-xs text-gray-400 capitalize flex-shrink-0">
                      {doc.type}
                    </span>
                  </a>
                ))}
              </div>
            </Card>
          )}

          {/* Receipt */}
          {request.receipt && (
            <Card>
              <h2 className="font-semibold text-gray-900 mb-3">Receipt</h2>
              <a
                href={request.receipt.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 transition-colors"
              >
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-green-700">{request.receipt.file_name}</span>
              </a>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Requester info */}
          {request.user && (
            <Card>
              <h2 className="font-semibold text-gray-900 mb-3">Requester</h2>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-700 font-semibold text-sm">
                    {request.user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{request.user.name}</p>
                  <p className="text-xs text-gray-400">{request.user.email}</p>
                  {request.user.department && (
                    <p className="text-xs text-gray-400">{request.user.department}</p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <h2 className="font-semibold text-gray-900 mb-3">Actions</h2>
            <div className="space-y-2">
              {request.status === 'pending' && (
                <>
                  <Button
                    onClick={handleApprove}
                    isLoading={isProcessing}
                    className="w-full"
                    leftIcon={<CheckCircle className="w-4 h-4" />}
                  >
                    Approve Request
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setShowRejectModal(true)}
                    disabled={isProcessing}
                    className="w-full"
                    leftIcon={<XCircle className="w-4 h-4" />}
                  >
                    Reject Request
                  </Button>
                </>
              )}

              {request.status === 'approved' && (
                <Button
                  onClick={handleMarkPaid}
                  isLoading={isProcessing}
                  className="w-full"
                  leftIcon={<DollarSign className="w-4 h-4" />}
                >
                  Mark as Paid
                </Button>
              )}

              {request.status === 'paid' && !request.receipt && (
                <Button
                  variant="secondary"
                  onClick={() => setShowReceiptModal(true)}
                  disabled={isProcessing}
                  className="w-full"
                  leftIcon={<Upload className="w-4 h-4" />}
                >
                  Upload Receipt
                </Button>
              )}

              {(request.status === 'completed' || request.status === 'rejected') && (
                <p className="text-sm text-gray-400 text-center py-2">
                  No actions available for this request.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectionReason('');
        }}
        title="Reject Request"
        size="md"
      >
        <ModalBody>
          <p className="text-sm text-gray-600 mb-4">
            Please provide a reason for rejecting this request. This will be shared with the requester.
          </p>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Enter rejection reason..."
            rows={4}
            className="input-field resize-none"
          />
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setShowRejectModal(false);
              setRejectionReason('');
            }}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleReject} isLoading={isProcessing}>
            Reject Request
          </Button>
        </ModalFooter>
      </Modal>

      {/* Receipt Upload Modal */}
      <Modal
        isOpen={showReceiptModal}
        onClose={() => {
          setShowReceiptModal(false);
          setReceiptFile(null);
        }}
        title="Upload Receipt"
        size="sm"
      >
        <ModalBody>
          <p className="text-sm text-gray-600 mb-4">
            Upload the payment receipt to complete this request.
          </p>
          <label className="block w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors">
            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {receiptFile ? receiptFile.name : 'Click to select receipt file'}
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG up to 10MB</p>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setShowReceiptModal(false);
              setReceiptFile(null);
            }}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReceiptUpload}
            isLoading={isProcessing}
            disabled={!receiptFile}
          >
            Upload Receipt
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
