"use client";

import { forwardRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import type { GalleryEvent } from "@/lib/events";

interface GalleryCardProps {
  event: GalleryEvent;
  index: number;
  width: number;
  onSelect: (event: GalleryEvent, triggerEl: HTMLButtonElement) => void;
  priority?: boolean;
}

function formatCardDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * A single gallery card. The outer element is forwarded so GalleryStrip can
 * imperatively set its 3D transform every animation frame — that value
 * changes far too often to run through React state/props without cost.
 */
const GalleryCard = forwardRef<HTMLButtonElement, GalleryCardProps>(
  function GalleryCard({ event, index, width, onSelect, priority }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        onClick={(e) => onSelect(event, e.currentTarget)}
        aria-label={`${event.title}, ${formatCardDate(event.date)}`}
        data-gallery-card-index={index}
        className="group relative shrink-0 select-none rounded-[14px] border border-white/10 bg-[#141414] text-left outline-none transition-[border-color,box-shadow] duration-300 focus-visible:ring-2 focus-visible:ring-[#EB0028] hover:border-[#EB0028]/70"
        style={{
          width,
          // Matches the 3300x4200 poster frame admins upload into.
          aspectRatio: "3300 / 4200",
          boxShadow: "0 18px 40px -20px rgba(0,0,0,0.7)",
          // The track wrapper disables pointer-events (see GalleryStrip) so
          // clicks reach the transformed card instead of its flat parent —
          // re-enable them here since pointer-events inherits.
          pointerEvents: "auto",
        }}
      >
        {/* Hover glow — neon-red, matches the site's signature treatment */}
        <div className="pointer-events-none absolute -inset-2 rounded-[20px] bg-[#EB0028]/0 opacity-0 blur-2xl transition-opacity duration-300 group-hover:bg-[#EB0028]/30 group-hover:opacity-100" />

        {/* Poster only — no title/date on the card, revealed in quick view instead */}
        <div className="relative h-full w-full overflow-hidden rounded-[14px]">
          <motion.div layoutId={`gallery-image-${event.id}`} className="absolute inset-0">
            <Image
              src={event.imageUrl}
              alt={event.imageAlt}
              fill
              draggable={false}
              priority={priority}
              sizes="(max-width: 767px) 150px, (max-width: 1279px) 180px, 220px"
              className="pointer-events-none object-cover"
              style={{
                objectPosition: `${event.focalPoint.x * 100}% ${event.focalPoint.y * 100}%`,
                transform: `scale(${event.zoom})`,
              }}
            />
          </motion.div>
        </div>
      </button>
    );
  },
);

export default GalleryCard;
