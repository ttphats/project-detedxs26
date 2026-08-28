"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowLeft, Camera } from "lucide-react";
import { GALLERY_SEASONS, photoAlt, type GalleryPhoto } from "@/lib/gallery-data";

gsap.registerPlugin(useGSAP);

/** Newest season is what the page should open on. */
const DEFAULT_YEAR = GALLERY_SEASONS[GALLERY_SEASONS.length - 1].year;

/** Seconds for a column to travel one full copy of its photos. */
const SCROLL_DURATION = 40;

/**
 * Varied tile heights, derived from the index rather than random so the
 * rhythm is identical on every render and the loop stays seamless.
 */
const HEIGHTS = [400, 300, 500, 350, 450, 300];
function heightFor(index: number): number {
  return HEIGHTS[index % HEIGHTS.length];
}

/** Deal the photos alternately into two columns. */
function splitColumns(photos: GalleryPhoto[]): [GalleryPhoto[], GalleryPhoto[]] {
  const left: GalleryPhoto[] = [];
  const right: GalleryPhoto[] = [];
  photos.forEach((p, i) => (i % 2 === 0 ? left : right).push(p));
  return [left, right];
}

export default function GalleryPage() {
  const [activeYear, setActiveYear] = useState(DEFAULT_YEAR);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  const season = useMemo(
    () => GALLERY_SEASONS.find((s) => s.year === activeYear)!,
    [activeYear],
  );

  const [colA, colB] = useMemo(() => splitColumns(season.photos), [season]);

  /**
   * The two columns drift in opposite directions, for ever.
   *
   * Each column renders its photos twice and travels exactly one copy
   * (`yPercent: -50`), so the seam never shows. GSAP rather than CSS keyframes
   * because the tweens have to be pausable on hover and re-created when the
   * season changes — and because `ease: "none"` on a transform keeps the whole
   * thing on the compositor.
   */
  useGSAP(
    () => {
      const area = scrollAreaRef.current;
      if (!area) return;

      const columns = gsap.utils.toArray<HTMLElement>("[data-column]");
      if (columns.length === 0) return;

      const mm = gsap.matchMedia();
      mm.add(
        {
          reduced: "(prefers-reduced-motion: reduce)",
          full: "(prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          const {reduced} = ctx.conditions as {reduced: boolean};

          if (reduced) {
            // No drift at all — the photos simply sit there, scrollable by hand.
            gsap.set(columns, {yPercent: 0});
            return;
          }

          const tweens = columns.map((col) => {
            const down = col.dataset.column === "down";
            return gsap.fromTo(
              col,
              {yPercent: down ? -50 : 0},
              {
                yPercent: down ? 0 : -50,
                duration: SCROLL_DURATION,
                ease: "none",
                repeat: -1,
              },
            );
          });

          // Pause while the visitor is looking at something.
          const pause = () => tweens.forEach((t) => t.pause());
          const resume = () => tweens.forEach((t) => t.resume());
          area.addEventListener("mouseenter", pause);
          area.addEventListener("mouseleave", resume);
          // Touch has no hover, so a tap holds the columns still.
          area.addEventListener("touchstart", pause, {passive: true});
          area.addEventListener("touchend", resume);

          return () => {
            area.removeEventListener("mouseenter", pause);
            area.removeEventListener("mouseleave", resume);
            area.removeEventListener("touchstart", pause);
            area.removeEventListener("touchend", resume);
          };
        },
        scrollAreaRef,
      );
    },
    {
      scope: scrollAreaRef,
      dependencies: [activeYear],
      revertOnUpdate: true,
    },
  );

  /**
   * Season copy transition — driven by state, so it runs after React has
   * rendered the new season and cannot fall out of step with it.
   */
  useGSAP(
    () => {
      const el = copyRef.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      mm.add(
        {
          reduced: "(prefers-reduced-motion: reduce)",
          full: "(prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          const {reduced} = ctx.conditions as {reduced: boolean};
          if (reduced) {
            gsap.set(el, {autoAlpha: 1, x: 0});
            return;
          }
          gsap
            .timeline({defaults: {ease: "power2.out"}})
            .fromTo(el, {autoAlpha: 0, x: 18}, {autoAlpha: 1, x: 0, duration: 0.45})
            // The year gets a beat of its own so the change registers.
            .from(
              el.querySelector("h1"),
              {scale: 0.92, duration: 0.5, ease: "back.out(1.6)"},
              "<",
            );
        },
      );
    },
    {dependencies: [activeYear]},
  );

  const renderColumn = (photos: GalleryPhoto[], direction: "up" | "down") => (
    <div
      data-column={direction}
      className="flex flex-col gap-4"
      style={{willChange: "transform"}}
    >
      {/* Rendered twice: the tween travels exactly one copy, so the join is
          invisible and the drift never appears to restart. */}
      {[...photos, ...photos].map((photo, i) => (
        <div
          key={`${photo.src}-${i}`}
          className="group relative shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] transition-all duration-500 hover:border-red-500/50 hover:shadow-[0_0_30px_rgba(230,43,30,0.3)]"
          style={{height: heightFor(i)}}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.src}
            alt={photoAlt(photo, season.year)}
            loading="lazy"
            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
          />
          <span className="absolute bottom-3 left-3 text-[10px] font-bold uppercase tracking-wider text-white/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {photo.category}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Ambient glows — depth through light on a dark plane, not shadows. */}
      <div aria-hidden className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full opacity-30 blur-[120px] bg-[radial-gradient(ellipse_at_center,rgba(230,43,30,0.45)_0%,transparent_70%)]" />
        <div className="absolute bottom-0 right-0 w-[520px] h-[520px] rounded-full opacity-20 blur-[120px] bg-[radial-gradient(ellipse_at_center,rgba(230,43,30,0.3)_0%,transparent_70%)]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors group mb-8"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Home
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left: the season's story */}
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-600/10 mb-6">
              <Camera className="w-3.5 h-3.5 text-red-500" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-400">
                Gallery
              </span>
            </div>

            <div ref={copyRef}>
              <h1 className="text-[76px] sm:text-[110px] font-black leading-[0.85] tracking-tighter text-white/90 tabular-nums">
                {season.year}
              </h1>
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500 mt-2 mb-5">
                {season.theme}
              </p>
              <p className="text-gray-400 text-base leading-relaxed max-w-md">
                {season.blurb}
              </p>
              <p className="mt-5 text-xs uppercase tracking-widest text-gray-600">
                {season.photos.length} photos · hover to pause
              </p>
            </div>

            {/* Season switcher */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-3">
                Season
              </p>
              <div className="flex flex-wrap gap-2">
                {GALLERY_SEASONS.map((s) => {
                  const active = s.year === activeYear;
                  return (
                    <button
                      key={s.year}
                      type="button"
                      onClick={() => setActiveYear(s.year)}
                      aria-pressed={active}
                      className={`px-4 py-2 rounded-lg text-sm font-bold tabular-nums transition-all duration-300 border ${
                        active
                          ? "bg-red-600 border-red-600 text-white shadow-[0_0_18px_rgba(230,43,30,0.5)] scale-105"
                          : "border-white/10 text-gray-400 hover:text-white hover:border-white/30 hover:bg-white/[0.04] active:scale-95"
                      }`}
                    >
                      {s.year}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: the drifting columns, held inside a fixed window that
              fades out top and bottom so photos enter and leave rather than
              being cut off. */}
          <div
            ref={scrollAreaRef}
            className="lg:col-span-7 relative h-[560px] lg:h-[819px] overflow-hidden"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent, black 6%, black 94%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent, black 6%, black 94%, transparent)",
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              {renderColumn(colA, "up")}
              {renderColumn(colB, "down")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
