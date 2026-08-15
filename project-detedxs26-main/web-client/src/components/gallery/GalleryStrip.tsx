"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GalleryEvent } from "@/lib/events";
import GalleryCard from "./GalleryCard";
import { useDragScroll } from "./useDragScroll";

const GAP = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface Breakpoint {
  cardWidth: number;
  maxRotateDeg: number;
}

function getBreakpoint(windowWidth: number): Breakpoint {
  if (windowWidth < 768) return { cardWidth: 150, maxRotateDeg: 0 };
  if (windowWidth < 1280) return { cardWidth: 180, maxRotateDeg: 12 };
  return { cardWidth: 220, maxRotateDeg: 18 };
}

interface GalleryStripProps {
  events: GalleryEvent[];
  onSelect: (event: GalleryEvent, triggerEl: HTMLButtonElement) => void;
  /** Freezes idle auto-scroll while true, e.g. the quick-view modal is open. */
  paused?: boolean;
}

const AUTO_SCROLL_SPEED = 0.025; // px/ms ≈ 25px/sec — slow, ambient
const AUTO_SCROLL_IDLE_DELAY_MS = 3000;

export default function GalleryStrip({ events, onSelect, paused }: GalleryStripProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reducedMotionRef = useRef(false);

  const [containerWidth, setContainerWidth] = useState(0);
  // Must match between server and client's first render pass (no `window`
  // on the server) — always start at the desktop breakpoint and correct it
  // synchronously in the layout effect below, before paint.
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => getBreakpoint(1280));

  // Measure synchronously before paint so the drag hook's initial-position
  // effect (a passive effect) sees the real width, not the 0 default.
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const measure = () => {
      setContainerWidth(el.offsetWidth);
      setBreakpoint(getBreakpoint(window.innerWidth));
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const handler = () => {
      reducedMotionRef.current = mq.matches;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const { cardWidth, maxRotateDeg } = breakpoint;
  const trackWidth = useMemo(
    () => (events.length > 0 ? events.length * cardWidth + (events.length - 1) * GAP : 0),
    [events.length, cardWidth],
  );

  const getBounds = useCallback(() => {
    // Fewer cards than fit on screen (including just one) — center the
    // track instead of pinning it to the left edge. Nothing to drag either
    // way, so min and max collapse to the same centered value.
    if (trackWidth <= containerWidth) {
      const centered = (containerWidth - trackWidth) / 2;
      return { min: centered, max: centered };
    }
    const min = Math.min(0, containerWidth - trackWidth);
    return { min, max: 0 };
  }, [containerWidth, trackWidth]);

  const getInitialX = useCallback(() => {
    const { min, max } = getBounds();
    return (min + max) / 2;
  }, [getBounds]);

  const applyTransforms = useCallback(
    (x: number) => {
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${x}px, 0, 0)`;
      }

      const centerX = containerWidth / 2;
      const reduced = reducedMotionRef.current;

      cardRefs.current.forEach((el, i) => {
        if (!el) return;

        if (reduced || centerX === 0) {
          el.style.transform = "";
          el.style.opacity = "1";
          return;
        }

        const cardCenter = x + i * (cardWidth + GAP) + cardWidth / 2;
        const dist = cardCenter - centerX;
        const norm = clamp(dist / centerX, -1, 1);
        const falloff = Math.min(1, Math.abs(norm));

        const rotateY = -norm * maxRotateDeg;
        const scale = 1 - falloff * 0.12;
        const opacity = 1 - falloff * 0.35;
        const translateZ = -falloff * 60;

        el.style.transform = `translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;
        el.style.opacity = String(opacity);
      });
    },
    [containerWidth, cardWidth, maxRotateDeg],
  );

  const { containerRef, isDragging, bind } = useDragScroll({
    onUpdate: applyTransforms,
    getBounds,
    getInitialX,
    ready: containerWidth > 0,
    autoScroll: { speed: AUTO_SCROLL_SPEED, idleDelayMs: AUTO_SCROLL_IDLE_DELAY_MS },
    paused,
  });

  // Keep both refs pointed at the same viewport element.
  const setViewportRef = useCallback(
    (el: HTMLDivElement | null) => {
      viewportRef.current = el;
      containerRef.current = el;
    },
    [containerRef],
  );

  return (
    <div className="relative w-full overflow-hidden py-6" style={{ perspective: 1200 }}>
      {/* Edge fade masks so the strip reads as an infinite, half-cut row */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#0A0A0A] to-transparent sm:w-28" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#0A0A0A] to-transparent sm:w-28" />

      <div
        ref={setViewportRef}
        role="region"
        aria-label="Event gallery — drag or use arrow keys to browse"
        tabIndex={0}
        className={`w-full overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-[#EB0028]/60 ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ touchAction: "pan-y" }}
        {...bind}
      >
        <div
          ref={trackRef}
          className="flex will-change-transform"
          // pointer-events: none — this flat layout wrapper sits at z=0 in
          // the preserve-3d context, in front of any card that's rotated/
          // pushed back (translateZ) for the tilt effect. Without this, the
          // browser's 3D hit-test resolves clicks to this invisible parent
          // plane instead of the card behind it, so a card's onClick never
          // fires. GalleryCard re-enables pointer-events on the card itself.
          style={{ gap: GAP, transformStyle: "preserve-3d", pointerEvents: "none" }}
        >
          {events.map((event, i) => (
            <GalleryCard
              key={event.id}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              event={event}
              index={i}
              width={cardWidth}
              onSelect={onSelect}
              priority={i < 4}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
