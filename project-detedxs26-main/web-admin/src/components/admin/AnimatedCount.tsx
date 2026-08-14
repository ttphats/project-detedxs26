"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

interface AnimatedCountProps {
  value: number;
  className?: string;
}

/**
 * A number that counts up to `value` whenever it changes, so a check-in
 * visibly ticks the counter rather than silently swapping digits.
 *
 * Uses a ref for the target (never a bare selector) and re-runs on `value`
 * via the dependency array; useGSAP reverts its tweens on unmount for us.
 *
 * Note the reduced-motion handling: both the "reduce" and "no-preference"
 * cases are declared so one branch always matches. A single "reduce" query
 * would leave the handler unrun for most users, and the number would never
 * update at all.
 */
export default function AnimatedCount({ value, className }: AnimatedCountProps) {
  const elRef = useRef<HTMLSpanElement>(null);
  // The displayed number, kept outside React state so the tween can drive
  // the DOM directly every frame without re-rendering the tree.
  const shownRef = useRef(0);

  useGSAP(
    () => {
      const el = elRef.current;
      if (!el) return;

      const from = shownRef.current;
      const counter = { n: from };

      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
          fullMotion: "(prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          const { reduceMotion } = ctx.conditions as { reduceMotion: boolean };

          gsap.to(counter, {
            n: value,
            duration: reduceMotion ? 0 : 0.6,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = String(Math.round(counter.n));
            },
            onComplete: () => {
              el.textContent = String(value);
              shownRef.current = value;
            },
          });

          if (!reduceMotion && value !== from) {
            // A tiny pop so the change is noticeable at a glance.
            gsap.fromTo(
              el,
              { scale: 1.18 },
              { scale: 1, duration: 0.45, ease: "back.out(2)" },
            );
          }
        },
      );

      return () => mm.revert();
    },
    { dependencies: [value] },
  );

  return (
    <span ref={elRef} className={className}>
      0
    </span>
  );
}
