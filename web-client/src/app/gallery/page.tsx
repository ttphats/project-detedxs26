"use client";

import { useState, useRef, useMemo } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { NeonBackground } from "@/components";
import { GALLERY_SEASONS, photoAlt, type GalleryPhoto } from "@/lib/gallery-data";

gsap.registerPlugin(useGSAP);

/** Newest season is what the page should open on. */
const DEFAULT_YEAR = GALLERY_SEASONS[GALLERY_SEASONS.length - 1].year;

/**
 * Drift speed in pixels per second. Expressed as a speed rather than a
 * duration so seasons with different photo counts move at the same pace.
 * Slow enough that it reads as atmosphere rather than a carousel.
 */
const SCROLL_SPEED = 42;

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

      // Touch has no hover, so on a phone a press is what brings a photo's
      // colour back. Delegated from the scroll area rather than bound to each
      // tile: a season renders up to 34 of them and they are all replaced
      // when the season changes.
      //
      // Set up outside the matchMedia below so it survives reduced-motion —
      // that preference is about movement, not about withholding the one
      // interaction the page has.
      let held: HTMLElement | null = null;
      const release = () => {
        if (!held) return;
        delete held.dataset.held;
        held = null;
      };
      const hold = (event: Event) => {
        const tile = (event.target as HTMLElement | null)?.closest<HTMLElement>(
          "[data-photo]",
        );
        if (!tile || tile === held) return;
        release();
        held = tile;
        tile.dataset.held = "true";
      };
      area.addEventListener("touchstart", hold, {passive: true});
      // touchend covers a normal lift; touchcancel covers the browser taking
      // the gesture over, which is what a scroll from inside a tile does.
      area.addEventListener("touchend", release);
      area.addEventListener("touchcancel", release);

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

          // Each column is paused independently: reaching for a photo should
          // hold that column still and leave the other one drifting, so the
          // page never freezes wholesale.
          const cleanups = columns.map((col) => {
            const down = col.dataset.column === "down";

            // Measure one copy exactly, rather than assuming yPercent: -50.
            // Half the column is NOT one copy: with a flex gap between every
            // child, half the total overshoots by gap/2, and that error is
            // what made the loop jump each time it came round. The offset
            // between the first item and the first item of the duplicate set
            // is the true period.
            const items = Array.from(col.children) as HTMLElement[];
            const half = items.length / 2;
            const distance =
              half >= 1 && items[half]
                ? items[half].offsetTop - items[0].offsetTop
                : col.offsetHeight / 2;

            // Duration from distance so every season drifts at the same
            // speed — a nine-photo season would otherwise race a
            // seventeen-photo one.
            const duration = distance / SCROLL_SPEED;

            const tween = gsap.fromTo(
              col,
              {y: down ? -distance : 0},
              {
                y: down ? 0 : -distance,
                duration,
                ease: "none",
                repeat: -1,
              },
            );

            const pause = () => tween.pause();
            const resume = () => tween.resume();
            col.addEventListener("mouseenter", pause);
            col.addEventListener("mouseleave", resume);
            // Touch has no hover, so a press holds that column still.
            col.addEventListener("touchstart", pause, {passive: true});
            col.addEventListener("touchend", resume);

            return () => {
              col.removeEventListener("mouseenter", pause);
              col.removeEventListener("mouseleave", resume);
              col.removeEventListener("touchstart", pause);
              col.removeEventListener("touchend", resume);
            };
          });

          return () => cleanups.forEach((fn) => fn());
        },
        scrollAreaRef,
      );

      return () => {
        release();
        area.removeEventListener("touchstart", hold);
        area.removeEventListener("touchend", release);
        area.removeEventListener("touchcancel", release);
      };
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
          /* data-photo is what the delegated touch handler looks for, and
             data-held is what it sets while a finger is down — the touch
             counterpart of :hover, driving the same reveal. */
          data-photo
          className="group relative shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] transition-all duration-500 hover:border-red-500/60 hover:shadow-[0_0_10px_rgba(230,43,30,0.5),0_0_30px_rgba(230,43,30,0.35),0_0_60px_rgba(230,43,30,0.2)] data-[held=true]:border-red-500/60 data-[held=true]:shadow-[0_0_10px_rgba(230,43,30,0.5),0_0_30px_rgba(230,43,30,0.35),0_0_60px_rgba(230,43,30,0.2)]"
          style={{height: heightFor(i)}}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.src}
            alt={photoAlt(photo, season.year)}
            loading="lazy"
            /* Zoomed past the watermarks. The sources carry a TEDx lockup in
               the top-left — reaching 6.8% of the height in the 2023 batch,
               8.3% in 2024, 10.5% in 2025 — and a "powered by SKILLCETERA"
               strip in the bottom-right from ~91.9%. Opposite corners, so
               shifting the crop one way would only expose the other; a
               symmetric zoom is what clears both.

               1.32 trims 12.1% off every edge, clearing the deepest lockup
               by 1.6% rather than the 0.4% a tighter zoom left. The sources
               are 2048px wide against ~336px tiles, so the crop costs
               nothing in sharpness. */
            className="w-full h-full object-cover scale-[1.32] transition-all duration-500"
          />
          {/* Red wash on reveal, so colour returning reads as the neon
              catching the photograph rather than a plain filter toggle. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-red-950/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 group-data-[held=true]:opacity-100 transition-opacity duration-500"
          />
          <span className="absolute bottom-3 left-3 text-[10px] font-bold uppercase tracking-wider text-white opacity-0 group-hover:opacity-100 group-data-[held=true]:opacity-100 transition-opacity duration-300 neon-text-red">
            {photo.category}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    // -mb-20 cancels the pb-20 that layout.tsx puts on <main> to clear the
    // fixed mobile nav. On this page the photo window is meant to run right
    // up to the footer, and its own mask already fades the last photos out,
    // so that 80px of reserved space would just be a gap. Restored at md,
    // where the nav is hidden and the padding is zero anyway.
    <div className="min-h-screen bg-black text-white overflow-hidden -mb-20 md:mb-0">
      {/* Background is the home page's own treatment — the same .blob,
          .grid-pattern and .animate-float classes from globals.css — so the
          gallery reads as part of the site rather than a page of its own. */}
      {/* z-0, not -z-10: a negative z-index child paints *behind* this
          section's own bg-black, which hid the entire layer. Content above
          sits at z-10. */}
      <div aria-hidden className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Orbiting neon orbs, counter-rotating rings and an occasional
            light sweep — the layer that keeps the page alive while the
            columns drift. */}
        <NeonBackground />

        <div className="blob blob-red w-150 h-150 -top-40 -right-40 animate-morph" />
        <div
          className="blob blob-orange w-100 h-100 bottom-20 left-20 animate-morph"
          style={{animationDelay: "2s"}}
        />
        <div className="absolute inset-0 grid-pattern opacity-50" />

        {/* Drifting motes, as on the hero. */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-red-500 rounded-full animate-float opacity-60" />
        <div
          className="absolute top-1/3 right-1/3 w-1 h-1 bg-red-400 rounded-full animate-float"
          style={{animationDelay: "1s"}}
        />
        <div
          className="absolute bottom-1/4 left-1/3 w-3 h-3 bg-red-600/50 rounded-full animate-float"
          style={{animationDelay: "2s"}}
        />
        <div
          className="absolute top-2/3 right-1/4 w-2 h-2 bg-orange-500/40 rounded-full animate-float"
          style={{animationDelay: "3s"}}
        />
      </div>

      {/* Stacked (below lg) the photo window sits 1px clear of the season row
          above it and the footer below, so the drift reads as a band running
          the width of the screen. The desktop gaps are unchanged. */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-px lg:pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-px lg:gap-y-10 items-center">
          {/* Left: the season's story */}
          <div className="lg:col-span-5">
            <div ref={copyRef}>
              {/* The year is the page's neon sign: the site's glow-text
                  animation, matching the hero headline. */}
              {/* Vertical rhythm follows the mock: title tight to its
                  sub-head, a 16px gap to the sub-head, then 48px of air
                  before the season row. */}
              <h1 className="text-[76px] sm:text-[110px] font-black leading-none tracking-tighter text-red-600 tabular-nums italic animate-glow-text mb-2">
                {season.year}
              </h1>
              {/* The theme outranks its slogan, so it is set larger. The
                  letter-spacing comes down as the size goes up — 0.3em was
                  fine at 14px but would push this line past the column and
                  wrap it.

                  Not .neon-text-red here: that stacks three glows at full
                  opacity, which reads as a halo at 14px but smears the
                  letterforms at this size. One soft, low-opacity halo keeps
                  the neon suggestion and leaves the text crisp. */}
              <p
                /* text-balance so the wrap falls near the separator rather
                   than stranding a word — "Season 05 ·" / "All The Way"
                   instead of "…All The" / "Way". */
                className="text-2xl sm:text-3xl font-black uppercase tracking-[0.08em] leading-tight text-balance text-red-500 mb-4"
                style={{textShadow: "0 0 14px rgba(230, 43, 30, 0.4)"}}
              >
                {season.theme}
              </p>
              {/* The theme's hook, set above the description so the eye lands
                  on the idea before the paragraph explaining it. */}
              <p className="text-base sm:text-lg font-semibold text-white leading-snug max-w-md mb-3">
                {season.tagline}
              </p>
              <p className="text-gray-400 text-base leading-relaxed max-w-md mb-3">
                {season.blurb}
              </p>
              {/* The instruction has to name the input the reader actually
                  has, so it keys off hover capability rather than width — a
                  narrow desktop window still has a pointer. */}
              <p className="text-xs uppercase tracking-widest text-gray-600 mb-12">
                <span className="[@media(hover:hover)]:hidden">
                  Hold a photo to pause the column
                </span>
                <span className="hidden [@media(hover:hover)]:inline">
                  Hover a photo to pause the column
                </span>
              </p>
            </div>

            {/* Season switcher — the label shares the line with the years,
                so the whole control reads as one row. It still wraps on a
                narrow screen, hence flex-wrap and the split gap. */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400">
                  Season
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {GALLERY_SEASONS.map((s) => {
                    const active = s.year === activeYear;
                    return (
                      <button
                        key={s.year}
                        type="button"
                        onClick={() => setActiveYear(s.year)}
                        aria-pressed={active}
                        className={`px-4 py-2 rounded-lg text-[15px] font-bold tabular-nums tracking-wide transition-all duration-300 ${
                          active
                            ? // No scale on the active year: in a single row it
                              // nudges its neighbours about. The glow carries it.
                              "bg-red-600 text-white neon-border shadow-lg shadow-red-600/30"
                            : "border border-white/10 text-gray-300 hover:text-white hover:border-red-500/40 hover:bg-white/[0.06] active:scale-95"
                        }`}
                      >
                        {s.year}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right: the drifting columns, held inside a fixed window that
              fades out top and bottom so photos enter and leave rather than
              being cut off. */}
          <div
            ref={scrollAreaRef}
            /* Tall enough to run from just under the nav bar to just above
               the footer, with the fade tightened to the edges so photos are
               still arriving and leaving right at the boundaries. */
            className="lg:col-span-7 relative h-[70vh] lg:h-[calc(100vh-8rem)] overflow-hidden"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent, black 3%, black 97%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent, black 3%, black 97%, transparent)",
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
