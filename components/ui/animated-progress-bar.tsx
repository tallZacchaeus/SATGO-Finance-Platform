'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface AnimatedProgressBarProps {
  value: number; // 0–100
  color?: string;
  height?: string;
  className?: string;
  showLabel?: boolean;
}

export function AnimatedProgressBar({
  value,
  color = '#D4A843',
  height = 'h-1.5',
  className = '',
  showLabel = false,
}: AnimatedProgressBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const clamped = Math.min(Math.max(value, 0), 100);

  // Color based on utilization
  const barColor =
    clamped >= 90 ? '#F87171' :
    clamped >= 70 ? '#FBBF24' :
    color;

  return (
    <div ref={ref} className={`w-full ${className}`}>
      <div
        className={`w-full ${height} rounded-full overflow-hidden`}
        style={{ background: '#2D1A73' }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: barColor }}
          initial={{ width: 0 }}
          animate={isInView ? { width: `${clamped}%` } : { width: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        />
      </div>
      {showLabel && (
        <span className="text-xs mt-1 block" style={{ color: '#A89FB8' }}>
          {clamped.toFixed(1)}%
        </span>
      )}
    </div>
  );
}
