"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { GalleryEvent } from "@/lib/events";

interface QuickViewModalProps {
  events: GalleryEvent[];
  selectedIndex: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
  /** Element to return focus to when the modal closes. */
  triggerRef: React.RefObject<HTMLElement | null>;
}

function formatModalDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function QuickViewModal({
  events,
  selectedIndex,
  onClose,
  onNavigate,
  triggerRef,
}: QuickViewModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isOpen = selectedIndex !== null;
  const event = isOpen ? events[selectedIndex] : null;

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Focus the panel on open; restore focus to the triggering card on close.
  useEffect(() => {
    if (isOpen) {
      panelRef.current?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [isOpen, triggerRef]);

  // Escape to close, arrow keys to navigate, basic focus trap (Tab cycles
  // within the panel instead of escaping to the page behind it).
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" && selectedIndex !== null && selectedIndex > 0) {
        e.preventDefault();
        onNavigate(selectedIndex - 1);
        return;
      }
      if (
        e.key === "ArrowRight" &&
        selectedIndex !== null &&
        selectedIndex < events.length - 1
      ) {
        e.preventDefault();
        onNavigate(selectedIndex + 1);
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, events.length, onClose, onNavigate]);

  return (
    <AnimatePresence>
      {isOpen && event && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div
            className="absolute inset-0 bg-black/85 backdrop-blur-[8px]"
            onClick={onClose}
            aria-hidden="true"
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gallery-quickview-title"
            tabIndex={-1}
            className="relative flex max-h-[90vh] w-full max-w-[1000px] flex-col overflow-hidden rounded-[20px] border border-white/10 bg-[#141414] shadow-[0_0_80px_-20px_rgba(235,0,40,0.35)] outline-none sm:flex-row"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition-colors hover:bg-[#EB0028] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Prev / next */}
            {selectedIndex !== null && selectedIndex > 0 && (
              <button
                type="button"
                onClick={() => onNavigate(selectedIndex - 1)}
                aria-label="Previous event"
                className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition-colors hover:bg-[#EB0028] hover:text-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {selectedIndex !== null && selectedIndex < events.length - 1 && (
              <button
                type="button"
                onClick={() => onNavigate(selectedIndex + 1)}
                aria-label="Next event"
                className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition-colors hover:bg-[#EB0028] hover:text-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}

            {/* Poster — same fixed 3300x4200 frame as the admin editor and the
                public card, so the crop shown here always matches exactly
                what was configured (a different aspect ratio here would
                reveal/hide different parts of the image than intended). */}
            <div
              className="relative w-full shrink-0 overflow-hidden sm:w-[45%]"
              style={{ aspectRatio: "3300 / 4200" }}
            >
              <motion.div layoutId={`gallery-image-${event.id}`} className="absolute inset-0">
                <Image
                  src={event.imageUrl}
                  alt={event.imageAlt}
                  fill
                  sizes="(max-width: 639px) 100vw, 450px"
                  className="object-cover"
                  style={{
                    objectPosition: `${event.focalPoint.x * 100}% ${event.focalPoint.y * 100}%`,
                    transform: `scale(${event.zoom})`,
                  }}
                />
              </motion.div>
            </div>

            {/* Details */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#EB0028]">
                    {formatModalDate(event.date)}
                  </p>
                  <h2
                    id="gallery-quickview-title"
                    className="mt-2 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl"
                  >
                    {event.title}
                  </h2>

                  {event.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {event.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#A1A1A1]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="mt-5 text-[15px] leading-relaxed text-[#A1A1A1]">
                    {event.description}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
