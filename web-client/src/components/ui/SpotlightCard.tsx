"use client";

import { useRef, useState, type ReactNode, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * SpotlightCard — Aceternity-style card with a mouse-following radial
 * spotlight glow. The spotlight is rendered via a CSS radial-gradient
 * bound to --x/--y CSS variables updated on pointermove. Works on touch
 * (spotlight fades out) and respects prefers-reduced-motion (no glow).
 *
 * Wrap any content; the glow color is driven by `glowColor`.
 */
export default function SpotlightCard({
  children,
  className,
  glowColor = "#e62b1e",
  radius = 500,
}: {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  radius?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: -1000, y: -1000 });
  const [active, setActive] = useState(false);

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => {
        setActive(false);
        setPos({ x: -1000, y: -1000 });
      }}
      className={cn(
        "group relative overflow-hidden",
        className,
      )}
      style={
        {
          "--glow-x": `${pos.x}px`,
          "--glow-y": `${pos.y}px`,
          "--glow-color": glowColor,
          "--glow-radius": `${radius}px`,
        } as React.CSSProperties
      }
    >
      {/* Spotlight layer — only visible while hovered */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 motion-reduce:hidden"
        style={{
          opacity: active ? 1 : 0,
          background:
            "radial-gradient(var(--glow-radius) circle at var(--glow-x) var(--glow-y), color-mix(in srgb, var(--glow-color) 18%, transparent), transparent 70%)",
        }}
      />
      {/* Content above the glow */}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
