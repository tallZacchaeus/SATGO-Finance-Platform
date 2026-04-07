import { RequestStatus } from '@/lib/types';
import {
  cn,
  getStatusColor,
  getStatusLabel,
  normalizeRequestStatus,
} from '@/lib/utils';

interface StatusBadgeProps {
  status: RequestStatus | string;
  className?: string;
  showDot?: boolean;
}

const dotColors: Record<RequestStatus, string> = {
  pending: 'bg-yellow-500',
  approved: 'bg-blue-500',
  rejected: 'bg-red-500',
  paid: 'bg-purple-500',
  completed: 'bg-green-500',
};

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const safeStatus = normalizeRequestStatus(status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
        getStatusColor(safeStatus),
        className
      )}
    >
      {showDot && (
        <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[safeStatus])} />
      )}
      {getStatusLabel(safeStatus)}
    </span>
  );
}
