"use client";

import {useRef} from "react";
import gsap from "gsap";
import {ScrollTrigger} from "gsap/ScrollTrigger";
import {useGSAP} from "@gsap/react";
import {groupSponsors, type Sponsor, type SponsorSize} from "@/lib/sponsors";

gsap.registerPlugin(useGSAP);

/**
 * White square tile per logo, sized by category weight. Square rather than
 * landscape so a near-square badge and a wide wordmark get the same footprint
 * and the row reads as a grid; object-contain inside does the fitting.
 */
const SLOT_SIZE: Record<SponsorSize, string> = {
  xl: "w-[160px] h-[160px] sm:w-[200px] sm:h-[200px]",
  lg: "w-[148px] h-[148px] sm:w-[184px] sm:h-[184px]",
  md: "w-[136px] h-[136px] sm:w-[168px] sm:h-[168px]",
  sm: "w-[120px] h-[120px] sm:w-[148px] sm:h-[148px]",
};

/** No hover state by request; the neon layer behind provides the motion. */
const SLOT_CLASS =
  "flex items-center justify-center rounded-2xl bg-white p-4 sm:p-5 " +
  "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_50px_-20px_rgba(230,43,30,0.45)]";

/** Typographic stand-in for a database sponsor that has no logo uploaded. */
function Wordmark({name}: {name: string}) {
  const long = name.length > 12;
  return (
    <span
      className={
        "text-center font-black uppercase leading-[1.05] tracking-tight text-zinc-900 " +
        (long ? "text-[11px] sm:text-sm" : "text-sm sm:text-base")
      }
    >
      {name}
    </span>
  );
}

function Logo({sponsor}: {sponsor: Sponsor}) {
  if (sponsor.logo_url) {
    const scale = sponsor.scale ?? 1;
    return (
      <img
        src={sponsor.logo_url}
        alt={sponsor.name}
        loading="lazy"
        className="h-full w-full object-contain"
        // A transform rather than a bigger slot, so the row's layout and the
        // baseline the other logos sit on are unchanged. Nothing clips it:
        // the slot has no background or overflow rule of its own.
        style={scale !== 1 ? {transform: `scale(${scale})`} : undefined}
      />
    );
  }
  return <Wordmark name={sponsor.name} />;
}

interface SponsorCategoriesProps {
  sponsors: Sponsor[];
}

export default function SponsorCategories({sponsors}: SponsorCategoriesProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const groups = groupSponsors(sponsors);

  /**
   * Scroll reveal, scoped to this block and reverted by useGSAP on unmount.
   * Everything is laid out visible in CSS and only hidden once GSAP is
   * actually running, so a failure to load the library still leaves every
   * sponsor on the page.
   */
  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);
      const headings = gsap.utils.toArray<HTMLElement>("[data-sponsor-heading]");
      const tiles = gsap.utils.toArray<HTMLElement>("[data-sponsor-tile]");
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
            gsap.set([...headings, ...tiles], {autoAlpha: 1, y: 0, scale: 1});
            return;
          }

          gsap.set(headings, {autoAlpha: 0, y: 14});
          gsap.set(tiles, {autoAlpha: 0, y: 26, scale: 0.9});

          ScrollTrigger.batch(headings, {
            start: "top 90%",
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                duration: 0.5,
                ease: "power2.out",
                overwrite: true,
              }),
          });

          // A touch of overshoot so the tiles land with a pop rather than
          // simply fading in, while the opacity still eases plainly.
          ScrollTrigger.batch(tiles, {
            start: "top 90%",
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                duration: 0.6,
                ease: "back.out(1.5)",
                stagger: {each: 0.06, from: "start"},
                overwrite: true,
              }),
          });
        },
        rootRef,
      );
    },
    {scope: rootRef, dependencies: [sponsors.length]},
  );

  if (groups.length === 0) return null;

  return (
    <div ref={rootRef} className="flex flex-col gap-14 sm:gap-20">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`sponsor-${group.key}`}>
          <div
            data-sponsor-heading
            className="mb-6 flex items-center justify-center gap-4 sm:mb-8"
          >
            <span className="hidden h-px max-w-[96px] flex-grow bg-white/15 sm:block" />
            <h3
              id={`sponsor-${group.key}`}
              className="text-center text-[11px] font-bold uppercase tracking-[0.3em] text-gray-300 sm:text-xs"
            >
              {group.label}
            </h3>
            <span className="hidden h-px max-w-[96px] flex-grow bg-white/15 sm:block" />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
            {group.sponsors.map((sponsor) => {
              const className = `${SLOT_CLASS} ${SLOT_SIZE[group.size]}`;
              const content = <Logo sponsor={sponsor} />;

              return sponsor.website ? (
                <a
                  key={sponsor.id}
                  data-sponsor-tile
                  href={sponsor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={sponsor.name}
                  className={className}
                >
                  {content}
                </a>
              ) : (
                <div
                  key={sponsor.id}
                  data-sponsor-tile
                  title={sponsor.name}
                  className={className}
                >
                  {content}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
