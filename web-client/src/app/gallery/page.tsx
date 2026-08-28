"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowLeft, Camera, X } from "lucide-react";
import {
  GALLERY_SEASONS,
  photoAlt,
  type GalleryPhoto,
} from "@/lib/gallery-data";

gsap.registerPlugin(useGSAP);

/** Newest season is what the page should open on. */
const DEFAULT_YEAR = GALLERY_SEASONS[GALLERY_SEASONS.length - 1].year;

/**
 * Masonry needs varied heights to read as masonry. Deriving the span from the
 * index keeps the rhythm stable across re-renders — a random height would
 * reshuffle the grid on every state change.
 */
function spanFor(index: number): string {
  const pattern = [
    "row-span-2",
    "row-span-3",
    "row-span-2",
    "row-span-4",
    "row-span-3",
    "row-span-2",
  ];
  return pattern[index % pattern.length];
}

export default function GalleryPage() {
  const [activeYear, setActiveYear] = useState(DEFAULT_YEAR);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [lightbox, setLightbox] = useState<
    (GalleryPhoto & { year: string }) | null
  >(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  const season = useMemo(
    () => GALLERY_SEASONS.find((s) => s.year === activeYear)!,
    [activeYear],
  );

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const p of season.photos) if (!seen.includes(p.category)) seen.push(p.category);
    return ["All", ...seen];
  }, [season]);

  const photos = useMemo(
    () =>
      activeCategory === "All"
        ? season.photos
        : season.photos.filter((p) => p.category === activeCategory),
    [season, activeCategory],
  );

  /**
   * Reveal the grid, and re-run whenever the season or filter changes.
   *
   * `revertOnUpdate` matters here: without it the tweens from the previous
   * season stay registered against elements React has already replaced, and
   * the new tiles never get their starting state.
   */
  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);
      const tiles = gsap.utils.toArray<HTMLElement>("[data-tile]");
      if (tiles.length === 0) return;

      const mm = gsap.matchMedia();
      mm.add(
        {
          reduced: "(prefers-reduced-motion: reduce)",
          full: "(prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          const {reduced} = ctx.conditions as {reduced: boolean};
          if (reduced) {
            gsap.set(tiles, {autoAlpha: 1, y: 0, scale: 1});
            return;
          }

          gsap.set(tiles, {autoAlpha: 0, y: 34, scale: 0.97});
          // batch so tiles arriving together animate together, rather than one
          // ScrollTrigger firing per image.
          ScrollTrigger.batch(tiles, {
            start: "top 92%",
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                duration: 0.6,
                ease: "power2.out",
                stagger: {amount: 0.35, from: "start"},
                overwrite: true,
              }),
          });
        },
        gridRef,
      );
    },
    {
      scope: gridRef,
      dependencies: [activeYear, activeCategory],
      revertOnUpdate: true,
    },
  );

  /**
   * Season copy transition.
   *
   * Driven by state rather than an imperative click handler: the year buttons
   * only change state, and this runs after React has rendered the new season.
   * That keeps the animation and the content in step — an imperative version
   * has to guess when the swap happened — and avoids creating GSAP objects
   * during render.
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
            .fromTo(
              el,
              {autoAlpha: 0, x: 18},
              {autoAlpha: 1, x: 0, duration: 0.45},
            )
            // The year itself gets a beat of its own so the change registers.
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

  const switchYear = (year: string) => {
    if (year === activeYear) return;
    setActiveYear(year);
    // Categories differ per season (only 2025 has workshops), so a filter
    // carried across would silently show an empty grid.
    setActiveCategory("All");
  };

  const openLightbox = useCallback(
    (photo: GalleryPhoto) => setLightbox({...photo, year: season.year}),
    [season.year],
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Ambient glows — the "light on a dark plane" depth from the design
          system, done with blurred radials rather than shadows. */}
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left: the season's story. Sticky on desktop so the copy stays with
              the photos as they scroll. */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
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
                  {season.photos.length} photos
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
                        onClick={() => switchYear(s.year)}
                        aria-pressed={active}
                        className={`px-4 py-2 rounded-lg text-sm font-bold tabular-nums transition-all duration-300 border ${
                          active
                            ? "bg-red-600 border-red-600 text-white shadow-[0_0_18px_rgba(230,43,30,0.5)]"
                            : "border-white/10 text-gray-400 hover:text-white hover:border-white/30 hover:bg-white/[0.04]"
                        }`}
                      >
                        {s.year}
                      </button>
                    );
                  })}
                </div>

                {/* Category filter */}
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mt-6 mb-3">
                  Filter
                </p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => {
                    const active = c === activeCategory;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setActiveCategory(c)}
                        aria-pressed={active}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 border ${
                          active
                            ? "border-red-500/50 bg-red-600/15 text-red-300"
                            : "border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/25"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right: the photos */}
          <div className="lg:col-span-7">
            <div
              ref={gridRef}
              className="grid grid-cols-2 sm:grid-cols-2 gap-4 auto-rows-[70px]"
            >
              {photos.map((photo, i) => (
                <button
                  key={photo.src}
                  type="button"
                  data-tile
                  onClick={() => openLightbox(photo)}
                  className={`group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] ${spanFor(i)} focus:outline-none focus:ring-2 focus:ring-red-500/60`}
                  style={{willChange: "transform"}}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.src}
                    alt={photoAlt(photo, season.year)}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-[1.04] transition-all duration-500"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  />
                  <span className="absolute bottom-2 left-2 right-2 text-left text-[10px] font-bold uppercase tracking-wider text-white/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {photo.category}
                  </span>
                  {/* Neon edge on hover — the design system's "active
                      elevation" is a glow, not a shadow. */}
                  <div
                    aria-hidden
                    className="absolute inset-0 rounded-xl ring-1 ring-transparent group-hover:ring-red-500/40 group-hover:shadow-[0_0_24px_rgba(230,43,30,0.28)] transition-all duration-300"
                  />
                </button>
              ))}
            </div>

            {photos.length === 0 && (
              <p className="text-gray-500 text-sm py-16 text-center">
                No photos in this category.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={photoAlt(lightbox, lightbox.year)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="absolute top-5 right-5 w-10 h-10 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.src}
            alt={photoAlt(lightbox, lightbox.year)}
            className="max-w-full max-h-[85vh] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-6 left-0 right-0 text-center text-xs uppercase tracking-[0.2em] text-gray-400">
            {lightbox.category} · {lightbox.year}
          </p>
        </div>
      )}
    </div>
  );
}
