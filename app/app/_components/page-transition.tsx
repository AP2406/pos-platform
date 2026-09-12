"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  /**
   * The shell passes `flex min-h-0 flex-1 flex-col` so this wrapper doesn't
   * break the height chain between <main> and a page that wants to fill the
   * screen — without it, a full-height page measures itself against a div that
   * has already collapsed to its content.
   */
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
