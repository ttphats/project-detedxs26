"use client";

import { useRef, useState } from "react";
import type { GalleryEvent } from "@/lib/events";
import GalleryStrip from "@/components/gallery/GalleryStrip";
import QuickViewModal from "@/components/gallery/QuickViewModal";

/** Owns quick-view selection state and wires GalleryStrip to QuickViewModal. */
export default function GalleryStripDemo({ events }: { events: GalleryEvent[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const handleSelect = (event: GalleryEvent, triggerEl: HTMLButtonElement) => {
    const index = events.findIndex((e) => e.id === event.id);
    if (index === -1) return;
    triggerRef.current = triggerEl;
    setSelectedIndex(index);
  };

  return (
    <>
      <GalleryStrip events={events} onSelect={handleSelect} paused={selectedIndex !== null} />
      <QuickViewModal
        events={events}
        selectedIndex={selectedIndex}
        onClose={() => setSelectedIndex(null)}
        onNavigate={setSelectedIndex}
        triggerRef={triggerRef}
      />
    </>
  );
}
