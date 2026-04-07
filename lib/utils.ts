import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { RequestStatus } from './types';

const REQUEST_STATUS_META: Record<RequestStatus, { color: string; label: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending Review' },
  approved: { color: 'bg-blue-100 text-blue-800', label: 'Approved' },
  rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected' },
  paid: { color: 'bg-purple-100 text-purple-800', label: 'Paid' },
  completed: { color: 'bg-green-100 text-green-800', label: 'Completed' },
};

function getValidDate(date: string | Date | null | undefined): Date | null {
  if (!date) {
    return null;
  }

  const parsed = date instanceof Date ? date : new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(safeAmount);
}

export function formatDate(date: string | Date | null | undefined): string {
  const parsed = getValidDate(date);
  return parsed ? format(parsed, 'MMM dd, yyyy') : 'Unknown date';
}

export function formatDateTime(date: string | Date | null | undefined): string {
  const parsed = getValidDate(date);
  return parsed ? format(parsed, 'MMM dd, yyyy HH:mm') : 'Unknown date';
}

export function normalizeRequestStatus(status: unknown): RequestStatus {
  return typeof status === 'string' && status in REQUEST_STATUS_META
    ? (status as RequestStatus)
    : 'pending';
}

export function getStatusColor(status: RequestStatus | string): string {
  return REQUEST_STATUS_META[normalizeRequestStatus(status)].color;
}

export function getStatusLabel(status: RequestStatus | string): string {
  return REQUEST_STATUS_META[normalizeRequestStatus(status)].label;
}
