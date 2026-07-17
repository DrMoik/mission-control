// ─── Pressable ────────────────────────────────────────────────────────────────
// Adds tap/press scale feedback to an element. The app already has hover states
// everywhere via CSS, but nothing responds to press/tap — this fills that gap.

import { motion, useReducedMotion } from 'motion/react';

export default function Pressable({ as = 'div', className = '', children, scale = 0.97, ...props }) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] || motion.div;
  return (
    <MotionTag
      className={className}
      whileTap={reduce ? undefined : { scale }}
      transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
      {...props}
    >
      {children}
    </MotionTag>
  );
}
