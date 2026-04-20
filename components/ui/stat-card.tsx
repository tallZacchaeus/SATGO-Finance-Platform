'use client';

import { motion } from 'framer-motion';
import { AnimatedNumber } from './animated-number';

// Serializable format descriptors — safe to pass from server components
export type StatCardFormat = 'currency-compact' | 'currency' | 'number' | 'count';

function applyFormat(n: number, format?: StatCardFormat): string {
  switch (format) {
    case 'currency-compact':
      return `₦${(n / 1_000_000).toFixed(1)}M`;
    case 'currency':
      return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
    case 'number':
    case 'count':
      return n.toLocaleString('en-NG');
    default:
      return String(n);
  }
}

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  animated?: boolean;
  format?: StatCardFormat;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  accentColor = '#D4A843',
  animated = true,
  format,
}: StatCardProps) {
  const isNumeric = typeof value === 'number';

  return (
    <motion.div
      className="relative rounded-xl p-5 overflow-hidden cursor-default"
      style={{
        background: '#13093B',
        border: '1px solid #2D1A73',
      }}
      whileHover={{
        y: -4,
        
        background: '#1A0F4D',
      }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full"
        style={{ background: accentColor }}
      />

      <div className="pl-3 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-body font-medium mb-2" style={{ color: '#A89FB8' }}>
            {title}
          </p>
          <p className="font-display text-2xl" style={{ color: '#F5E8D3' }}>
            {isNumeric && animated ? (
              <AnimatedNumber
                value={value as number}
                formatter={format ? (n) => applyFormat(n, format) : undefined}
              />
            ) : (
              value
            )}
          </p>
          {subtitle && (
            <p className="text-xs font-body mt-1" style={{ color: '#A89FB8' }}>
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ml-3"
            style={{ background: `${accentColor}15`, color: accentColor }}
          >
            {icon}
          </div>
        )}
      </div>
    </motion.div>
  );
}
