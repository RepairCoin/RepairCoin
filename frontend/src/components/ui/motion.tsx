"use client";

import React from "react";
import { motion, type Variants } from "framer-motion";

/**
 * Reusable entrance-animation primitives (framer-motion).
 *
 * - <Stagger>/<StaggerItem>: children rise + fade in one after another for a
 *   premium "cards cascading in" effect. Wrap a list of sections in <Stagger>
 *   and each direct child in <StaggerItem>.
 * - <FadeSlideIn>: a single block that fades + slides up on mount. Pass a
 *   changing `key` (e.g. the active tab) to replay the animation on change.
 */

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.03 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

interface MotionWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export const Stagger: React.FC<MotionWrapperProps> = ({ children, className }) => (
  <motion.div
    className={className}
    variants={containerVariants}
    initial="hidden"
    animate="show"
  >
    {children}
  </motion.div>
);

export const StaggerItem: React.FC<MotionWrapperProps> = ({ children, className }) => (
  <motion.div className={className} variants={itemVariants}>
    {children}
  </motion.div>
);

export const FadeSlideIn: React.FC<MotionWrapperProps> = ({ children, className }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);
