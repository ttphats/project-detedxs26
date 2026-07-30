"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";

/**
 * SmoothScroll provider — wraps the app to enable Lenis smooth scrolling.
 * Lenis is a lightweight, performant smooth-scroll library that gives a
 * buttery, native-app feel to the page. Respects prefers-reduced-motion.
 */
export default function SmoothScroll({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    // Respect reduced-motion users — skip Lenis entirely.
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
