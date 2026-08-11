import { getEvents } from "@/lib/events";
import Hero from "@/components/gallery/Hero";
import GalleryStripDemo from "./GalleryStripDemo";

// Events are mutated via admin CRUD (a different request, same in-memory
// store) — without this, Next statically caches the render on first load
// since the page has no cookies/headers/searchParams of its own, and never
// re-runs getEvents() again.
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const events = await getEvents();

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-[#0A0A0A] pt-28 pb-8 sm:pt-32">
      {/* Page-wide neon glow. Deliberately a *sibling* of the carousel here,
          not nested inside GalleryStrip's own wrapper — that wrapper sets
          `perspective` (for the card tilt effect) which makes it a
          containing block for `position: fixed` descendants, and it also
          clips with `overflow-hidden` for the drag strip. A glow placed
          inside it would get scoped and cut to that small strip instead of
          covering the page. */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute top-[8%] left-[12%] h-[500px] w-[500px] -translate-x-1/2 animate-pulse rounded-full bg-[#EB0028]/25 blur-[120px]"
          style={{ animationDuration: "4.5s" }}
        />
        <div
          className="absolute bottom-[12%] right-[8%] h-[460px] w-[460px] translate-x-1/2 animate-pulse rounded-full bg-[#EB0028]/25 blur-[110px]"
          style={{ animationDuration: "5.5s" }}
        />
        {/* Centered low behind the poster strip specifically — the strip
            otherwise sits on flat black with nothing to backlight it. */}
        <div
          className="absolute top-[80%] left-1/2 h-[700px] w-[1100px] -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-[#EB0028]/15 blur-[140px]"
          style={{ animationDuration: "6s" }}
        />
      </div>

      <Hero />
      <div className="relative shrink-0 pb-4">
        <GalleryStripDemo events={events} />
      </div>
    </div>
  );
}
