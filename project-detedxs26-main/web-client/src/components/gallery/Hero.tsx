"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Title block only — no photo background. The page-wide neon glow lives in
 * gallery/page.tsx (a fixed layer shared with the strip below), not here.
 */
export default function Hero() {
  const reducedMotion = useReducedMotion();

  const rise = (delay: number) => ({
    initial: { opacity: 0, y: reducedMotion ? 0 : 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: "easeOut" as const },
  });

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-4 text-center">
      <motion.div
        {...rise(0)}
        className="relative mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 backdrop-blur-sm"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-600 shadow-[0_0_8px_2px_rgba(230,43,30,0.7)]" />
        <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-gray-400">
          Our Event Archive
        </span>
      </motion.div>

      <motion.h1
        {...rise(0.08)}
        className="neon-text-red ted-logo-text relative text-5xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-7xl"
      >
        Gallery
      </motion.h1>

      <motion.p
        {...rise(0.16)}
        className="relative mt-5 max-w-md text-base text-gray-400 sm:text-lg"
      >
        Ideas worth spreading, moments worth remembering — every talk,
        workshop, and stage we&apos;ve built together.
      </motion.p>
    </div>
  );
}
