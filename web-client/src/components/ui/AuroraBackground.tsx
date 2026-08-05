"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * AuroraBackground — Aceternity-style animated aurora gradient background.
 * Renders slow-drifting colored blobs behind content. Purely decorative;
 * pointer-events disabled. Respects prefers-reduced-motion (static).
 *
 * Pass custom colors via `colors` (hex strings). Default = TEDx red palette.
 */
export default function AuroraBackground({
  children,
  className,
  colors = ["#e62b1e", "#ff6b5b", "#7a0e06"],
}: {
  children?: ReactNode;
  className?: string;
  colors?: string[];
}) {
  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      {/* Aurora blobs */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden motion-reduce:static"
        aria-hidden
      >
        {colors.map((c, i) => (
          <div
            key={i}
            className="absolute rounded-full blur-[90px] animate-aurora"
            style={{
              backgroundColor: `${c}33`,
              width: `${380 + i * 120}px`,
              height: `${380 + i * 120}px`,
              top: `${[-10, 30, 55][i % 3]}%`,
              left: `${[10, 65, 35][i % 3]}%`,
              animationDelay: `${i * 2.5}s`,
              animationDuration: `${14 + i * 3}s`,
            }}
          />
        ))}
      </div>
      {children}
    </div>
  );
}
