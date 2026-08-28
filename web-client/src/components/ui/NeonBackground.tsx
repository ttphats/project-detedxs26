"use client";

import { useRef } from "react";
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * NeonBackground — drifting neon orbs, orbit rings and a light sweep.
 *
 * Purely decorative and `pointer-events-none`, layered behind page content.
 * Everything animated is transform or opacity, so the whole layer stays on
 * the compositor and never triggers layout.
 *
 * Under `prefers-reduced-motion` nothing moves: the orbs are placed once and
 * left there, so the page keeps its atmosphere without anything travelling.
 */

/** Orbits, as SVG path data in a 0-1000 x 0-1000 viewBox. */
const ORBITS = [
  "M120,220 C320,60 700,120 880,300 C980,470 760,720 520,760 C280,800 80,600 120,220Z",
  "M820,160 C620,300 520,520 620,720 C700,880 380,900 240,760 C80,600 260,300 480,180 C620,110 760,90 820,160Z",
  "M300,820 C160,640 220,380 420,300 C640,210 880,340 900,540 C920,740 620,940 420,900 C370,890 330,860 300,820Z",
];

const ORB_COLORS = [
  "rgba(230,43,30,0.85)",
  "rgba(255,107,91,0.7)",
  "rgba(230,43,30,0.6)",
];

export default function NeonBackground({
  className = "",
}: {
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.registerPlugin(MotionPathPlugin);

      const orbs = gsap.utils.toArray<HTMLElement>("[data-orb]");
      const rings = gsap.utils.toArray<HTMLElement>("[data-ring]");
      const sweep = root.current?.querySelector("[data-sweep]") ?? null;

      const mm = gsap.matchMedia();
      mm.add(
        {
          reduced: "(prefers-reduced-motion: reduce)",
          full: "(prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          const {reduced} = ctx.conditions as {reduced: boolean};

          if (reduced) {
            // Park everything mid-orbit and stop. Still atmospheric, no motion.
            gsap.set(orbs, {autoAlpha: 0.5});
            gsap.set(sweep, {autoAlpha: 0});
            return;
          }

          // Each orb rides its own closed path, at its own pace, so they never
          // fall into step with one another.
          const duration = gsap.utils.random(26, 44, 1, true);
          orbs.forEach((orb, i) => {
            gsap.to(orb, {
              motionPath: {
                path: ORBITS[i % ORBITS.length],
                alignOrigin: [0.5, 0.5],
                start: gsap.utils.random(0, 1),
                end: gsap.utils.random(0, 1) + 1,
              },
              duration: duration(),
              ease: "none",
              repeat: -1,
            });

            // Slow breathing on top of the travel, so the glow pulses rather
            // than reading as a solid shape sliding about.
            gsap.to(orb, {
              scale: gsap.utils.random(1.15, 1.5),
              opacity: gsap.utils.random(0.6, 1),
              duration: gsap.utils.random(5, 9),
              ease: "sine.inOut",
              repeat: -1,
              yoyo: true,
              delay: i * 0.7,
            });
          });

          // Rings rotate in opposite directions — the "going around" made
          // literal, and cheap because it is one transform per element.
          rings.forEach((ring, i) => {
            gsap.to(ring, {
              rotation: i % 2 === 0 ? 360 : -360,
              duration: 40 + i * 18,
              ease: "none",
              repeat: -1,
              transformOrigin: "50% 50%",
            });
          });

          // A blade of light crossing the page now and then. Long gap between
          // passes so it stays an event rather than wallpaper.
          if (sweep) {
            gsap
              .timeline({repeat: -1, repeatDelay: 7})
              .fromTo(
                sweep,
                {xPercent: -140, autoAlpha: 0},
                {xPercent: 0, autoAlpha: 0.55, duration: 1.6, ease: "power1.out"},
              )
              .to(sweep, {
                xPercent: 140,
                autoAlpha: 0,
                duration: 1.6,
                ease: "power1.in",
              });
          }
        },
        root,
      );
    },
    {scope: root},
  );

  return (
    <div
      ref={root}
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {/* Orbiting neon orbs. Sized in vmin so they scale with the viewport. */}
      {ORB_COLORS.map((color, i) => (
        <div
          key={i}
          data-orb
          className="absolute top-0 left-0 rounded-full blur-[70px]"
          style={{
            width: `${22 + i * 8}vmin`,
            height: `${22 + i * 8}vmin`,
            background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
            willChange: "transform, opacity",
          }}
        />
      ))}

      {/* Thin neon rings, slowly counter-rotating. */}
      <div
        data-ring
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-500/20"
        style={{width: "72vmin", height: "72vmin", willChange: "transform"}}
      />
      <div
        data-ring
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-red-500/[0.12]"
        style={{width: "104vmin", height: "104vmin", willChange: "transform"}}
      />

      {/* Light sweep. */}
      <div
        data-sweep
        className="absolute top-0 bottom-0 w-[26vw] blur-[60px] opacity-0"
        style={{
          background:
            "linear-gradient(to right, transparent, rgba(230,43,30,0.7), transparent)",
          transform: "skewX(-14deg)",
          willChange: "transform, opacity",
        }}
      />
    </div>
  );
}
