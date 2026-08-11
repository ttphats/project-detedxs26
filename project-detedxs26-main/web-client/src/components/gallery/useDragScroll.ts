"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Pointer-driven horizontal drag-scroll with inertia, rubber-band resistance
 * at the bounds, and an idle auto-scroll that takes over when the user
 * hasn't interacted for a while. One code path handles mouse, touch, and pen
 * via the Pointer Events API. Position updates are pushed through `onUpdate`
 * every animation frame and applied by the caller directly to the DOM
 * (transforms only) — no React state is used for the per-frame value, so
 * dragging never triggers a re-render.
 */

const CLICK_DISTANCE_THRESHOLD = 8; // px — real pointing devices jitter a few px on a stationary click
const CLICK_TIME_THRESHOLD = 250; // ms
const RUBBER_BAND_FACTOR = 0.35;
const FRICTION_PER_16MS = 0.95;
const VELOCITY_STOP_EPSILON = 0.02; // px/ms
const SPRING_BACK_MS = 320;
const ARROW_KEY_STEP = 240; // px

export interface AutoScrollOptions {
  /** px/ms. 0.02 ≈ 20px/sec — slow, ambient motion. */
  speed: number;
  /** How long to wait after the last interaction before auto-scroll kicks in. */
  idleDelayMs?: number;
}

export interface UseDragScrollOptions {
  /** Called every animation frame with the current translateX (px, <= 0). */
  onUpdate: (x: number) => void;
  /** Recomputed on resize: how far the track can travel, e.g. -(trackWidth - containerWidth). */
  getBounds: () => { min: number; max: number };
  /** Starting position, applied once on mount / whenever bounds are (re)computed for the first time. */
  getInitialX: () => number;
  /**
   * True once the caller has a real container measurement. The very first
   * render/commit always has containerWidth 0 (no `window` on the server,
   * and the layout-effect measurement hasn't landed yet), so `getInitialX`
   * briefly points at a bogus "centered at zero width" position. Gating on
   * this instead of a plain "have we ever initialized" ref stops that bogus
   * value from ever being locked in — the position only gets set once a
   * real width is known, instead of silently freezing until the next
   * pointer interaction happens to force a bounds recheck.
   */
  ready: boolean;
  /** When set, the strip auto-advances after a period of no interaction. */
  autoScroll?: AutoScrollOptions;
  /** Freezes auto-scroll externally, e.g. while the quick-view modal is open. */
  paused?: boolean;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function useDragScroll({
  onUpdate,
  getBounds,
  getInitialX,
  ready,
  autoScroll,
  paused,
}: UseDragScrollOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const xRef = useRef(0);
  const initializedRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const autoScrollDirRef = useRef<1 | -1>(-1);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dragStateRef = useRef({
    pointerId: -1,
    startClientX: 0,
    startX: 0,
    startTime: 0,
    lastClientX: 0,
    lastTime: 0,
    velocity: 0, // px/ms
  });
  const suppressClickRef = useRef(false);
  const hasCapturedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const animRef = useRef<{
    kind: "inertia" | "spring" | "autoscroll";
    from: number;
    to: number;
    startTime: number;
    velocity: number;
  } | null>(null);

  // Track prefers-reduced-motion live.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const handler = () => {
      reducedMotionRef.current = mq.matches;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const setX = useCallback(
    (next: number) => {
      xRef.current = next;
      onUpdate(next);
    },
    [onUpdate],
  );

  useEffect(() => {
    if (initializedRef.current || !ready) return;
    initializedRef.current = true;
    setX(getInitialX());
  }, [getInitialX, ready, setX]);

  const stopAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    animRef.current = null;
  }, []);

  const runAutoScroll = useCallback(() => {
    if (!autoScroll || reducedMotionRef.current) return;
    // Nothing to scroll (e.g. only one card, already centered) — don't spin
    // a RAF loop forever for no visible effect.
    const initialBounds = getBounds();
    if (initialBounds.min === initialBounds.max) return;
    stopAnimation();

    let lastTime = performance.now();
    const step = (now: number) => {
      const { min, max } = getBounds();
      const dt = now - lastTime;
      lastTime = now;

      let next = xRef.current + autoScrollDirRef.current * autoScroll.speed * dt;
      if (next <= min) {
        next = min;
        autoScrollDirRef.current = 1;
      } else if (next >= max) {
        next = max;
        autoScrollDirRef.current = -1;
      }
      setX(next);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [autoScroll, getBounds, setX, stopAnimation]);

  const scheduleAutoScroll = useCallback(() => {
    if (!autoScroll) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(runAutoScroll, autoScroll.idleDelayMs ?? 3000);
  }, [autoScroll, runAutoScroll]);

  // Any real interaction interrupts auto-scroll/inertia/spring and resets
  // the idle clock; call at the start of every input handler below.
  const registerInteraction = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    stopAnimation();
  }, [stopAnimation]);

  const runSpringBack = useCallback(
    (from: number, to: number) => {
      stopAnimation();
      if (reducedMotionRef.current) {
        setX(to);
        scheduleAutoScroll();
        return;
      }
      animRef.current = { kind: "spring", from, to, startTime: performance.now(), velocity: 0 };
      const step = (now: number) => {
        const anim = animRef.current;
        if (!anim || anim.kind !== "spring") return;
        const elapsed = now - anim.startTime;
        const t = Math.min(1, elapsed / SPRING_BACK_MS);
        const eased = easeOutCubic(t);
        setX(anim.from + (anim.to - anim.from) * eased);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          stopAnimation();
          scheduleAutoScroll();
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [scheduleAutoScroll, setX, stopAnimation],
  );

  const runInertia = useCallback(
    (startVelocity: number) => {
      stopAnimation();
      const { min, max } = getBounds();

      if (reducedMotionRef.current || Math.abs(startVelocity) < VELOCITY_STOP_EPSILON) {
        const clamped = Math.min(max, Math.max(min, xRef.current));
        if (clamped !== xRef.current) {
          runSpringBack(xRef.current, clamped);
        } else {
          scheduleAutoScroll();
        }
        return;
      }

      let velocity = startVelocity;
      let lastTime = performance.now();

      const step = (now: number) => {
        const dt = now - lastTime;
        lastTime = now;

        const decay = Math.pow(FRICTION_PER_16MS, dt / 16.67);
        velocity *= decay;

        const next = xRef.current + velocity * dt;

        // Hit a bound while gliding — clamp and stop; the velocity has
        // already decayed most of the way by the time this happens, so a
        // hard stop at the wall reads as a natural settle.
        if (next < min || next > max) {
          setX(Math.min(max, Math.max(min, next)));
          stopAnimation();
          scheduleAutoScroll();
          return;
        }

        setX(next);

        if (Math.abs(velocity) < VELOCITY_STOP_EPSILON) {
          stopAnimation();
          scheduleAutoScroll();
          return;
        }
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [getBounds, runSpringBack, scheduleAutoScroll, setX, stopAnimation],
  );

  const applyDrag = useCallback(
    (clientX: number) => {
      const { min, max } = getBounds();
      const drag = dragStateRef.current;
      const rawX = drag.startX + (clientX - drag.startClientX);

      let displayX = rawX;
      if (rawX < min) {
        displayX = min + (rawX - min) * RUBBER_BAND_FACTOR;
      } else if (rawX > max) {
        displayX = max + (rawX - max) * RUBBER_BAND_FACTOR;
      }
      setX(displayX);
    },
    [getBounds, setX],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only primary button for mouse; touch/pen always allowed.
      if (e.pointerType === "mouse" && e.button !== 0) return;

      registerInteraction();
      // A prior gesture may have ended via pointercancel (e.g. an OS/browser
      // gesture interrupting a touch) without ever reaching onClickCapture
      // to clear this — reset explicitly so it can't leak into this press.
      suppressClickRef.current = false;
      hasCapturedRef.current = false;

      const now = performance.now();
      dragStateRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startX: xRef.current,
        startTime: now,
        lastClientX: e.clientX,
        lastTime: now,
        velocity: 0,
      };
      // Pointer capture is deferred to onPointerMove, once the gesture is
      // confirmed to be a real drag — see the note there for why.
    },
    [registerInteraction],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragStateRef.current;
      if (drag.pointerId !== e.pointerId) return;

      const now = performance.now();
      const dt = Math.max(1, now - drag.lastTime);
      const instVelocity = (e.clientX - drag.lastClientX) / dt;
      // Exponential moving average smooths out jittery pointer sampling.
      drag.velocity = drag.velocity * 0.7 + instVelocity * 0.3;
      drag.lastClientX = e.clientX;
      drag.lastTime = now;

      const totalDistance = Math.abs(e.clientX - drag.startClientX);
      const elapsed = now - drag.startTime;
      if (totalDistance > CLICK_DISTANCE_THRESHOLD || elapsed > CLICK_TIME_THRESHOLD) {
        suppressClickRef.current = totalDistance > CLICK_DISTANCE_THRESHOLD;
      }

      // Capture the pointer lazily, only once the gesture has actually moved
      // past click-jitter range. Capturing eagerly on pointerdown (the more
      // obvious place) retargets the browser's synthesized `click` event to
      // this container for *every* press — including plain clicks — so a
      // card button's onClick never fires. Waiting for real movement keeps
      // untouched clicks native while still capturing in time for the drag
      // to keep tracking the pointer past the container's edges.
      if (totalDistance > CLICK_DISTANCE_THRESHOLD && !hasCapturedRef.current) {
        hasCapturedRef.current = true;
        containerRef.current?.setPointerCapture(e.pointerId);
        setIsDragging(true);
      }

      applyDrag(e.clientX);
    },
    [applyDrag],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragStateRef.current;
      if (drag.pointerId !== e.pointerId) return;

      if (hasCapturedRef.current) {
        containerRef.current?.releasePointerCapture(e.pointerId);
      }
      setIsDragging(false);
      drag.pointerId = -1;

      const { min, max } = getBounds();
      if (xRef.current < min || xRef.current > max) {
        const target = xRef.current < min ? min : max;
        runSpringBack(xRef.current, target);
      } else {
        // px/ms -> continue as inertia glide
        runInertia(drag.velocity);
      }
    },
    [getBounds, runInertia, runSpringBack],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      // Prefer native horizontal wheel/trackpad delta; fall back to
      // Shift + vertical wheel for standard mice.
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (delta === 0) return;
      e.preventDefault();
      registerInteraction();
      const { min, max } = getBounds();
      const next = Math.min(max, Math.max(min, xRef.current - delta));
      setX(next);
      scheduleAutoScroll();
    },
    [getBounds, registerInteraction, scheduleAutoScroll, setX],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      registerInteraction();
      const { min, max } = getBounds();
      const direction = e.key === "ArrowLeft" ? 1 : -1;
      const target = Math.min(max, Math.max(min, xRef.current + direction * ARROW_KEY_STEP));
      runSpringBack(xRef.current, target);
    },
    [getBounds, registerInteraction, runSpringBack],
  );

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  }, []);

  // Re-clamp on resize (e.g. orientation change) without a jarring jump.
  useEffect(() => {
    const handleResize = () => {
      const { min, max } = getBounds();
      const clamped = Math.min(max, Math.max(min, xRef.current));
      if (clamped !== xRef.current) setX(clamped);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [getBounds, setX]);

  // Kick off the idle auto-scroll countdown on mount, and re-arm/freeze it
  // whenever `paused` toggles (e.g. the quick-view modal opening/closing).
  useEffect(() => {
    if (paused) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      stopAnimation();
    } else {
      scheduleAutoScroll();
    }
  }, [paused, scheduleAutoScroll, stopAnimation]);

  // Unmount cleanup.
  useEffect(() => {
    return () => {
      stopAnimation();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [stopAnimation]);

  return {
    containerRef,
    isDragging,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onWheel,
      onKeyDown,
      onClickCapture,
    },
  };
}
