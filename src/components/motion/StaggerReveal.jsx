// ─── StaggerReveal ────────────────────────────────────────────────────────────
// Entrance motion for dynamic-length lists/grids (.map() renders).
// Replaces the old fixed animate-delay-1/2/3 classes, which only cover 3 items —
// StaggerList staggers however many StaggerItem children actually render.

import { motion, useReducedMotion } from 'motion/react';

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

export function StaggerList({ as = 'div', className = '', children, ...props }) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] || motion.div;
  return (
    <MotionTag
      className={className}
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={listVariants}
      {...props}
    >
      {children}
    </MotionTag>
  );
}

export function StaggerItem({ as = 'div', className = '', children, ...props }) {
  const MotionTag = motion[as] || motion.div;
  return (
    <MotionTag className={className} variants={itemVariants} {...props}>
      {children}
    </MotionTag>
  );
}
