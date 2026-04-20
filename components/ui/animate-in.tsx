'use client';

import { motion, type Variants } from 'framer-motion';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as [number, number, number, number];

interface AnimateInProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'left' | 'right' | 'none';
  duration?: number;
  className?: string;
}

export function AnimateIn({
  children,
  delay = 0,
  direction = 'up',
  duration = 0.5,
  className,
}: AnimateInProps) {
  const directionMap = {
    up:    { y: 20, x: 0 },
    left:  { y: 0,  x: -20 },
    right: { y: 0,  x: 20 },
    none:  { y: 0,  x: 0 },
  };

  const offset = directionMap[direction];

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...offset }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{
        duration,
        delay: delay / 1000,
        ease: EASE_OUT_EXPO,
      }}
    >
      {children}
    </motion.div>
  );
}

/** Staggered container — wraps a list of AnimateInItem children */
export const staggerContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show:   {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE_OUT_EXPO },
  },
};

interface StaggerProps {
  children: React.ReactNode;
  className?: string;
}

export function StaggerList({ children, className }: StaggerProps) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: StaggerProps) {
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  );
}
