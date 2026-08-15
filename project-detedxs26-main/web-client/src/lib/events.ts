/**
 * Events Gallery data layer — mocked with an in-memory store so the public
 * gallery page and admin CRUD page can be built against a stable, typed API
 * before a real backend endpoint exists. Swap the function bodies for fetch
 * calls later; callers should never depend on the storage mechanism.
 *
 * The store lives on `globalThis`, not a plain module-level variable:
 * Next.js/Turbopack can bundle a Route Handler (app/api/gallery/route.ts)
 * and a Page (app/gallery/page.tsx) as separate compilation units, each
 * getting its *own* evaluated copy of this module — a plain `let events`
 * would silently diverge into two independent arrays. `globalThis` is the
 * one thing guaranteed to be shared across every bundle in the same process
 * (the same trick Next.js docs recommend for avoiding duplicate Prisma
 * Client instances in dev).
 */

export interface GalleryEvent {
  id: string;
  title: string;
  description: string;
  /** ISO date string */
  date: string;
  imageUrl: string;
  imageAlt: string;
  /** 0–1, drives object-position in the fixed 3:4 card frame */
  focalPoint: { x: number; y: number };
  /** 1–2, drives scale inside the frame */
  zoom: number;
  tags: string[];
  /** Hidden events never render on the public page */
  isVisible: boolean;
  /** Ascending left-to-right order on the public strip */
  order: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __galleryEventsStore: GalleryEvent[] | undefined;
}

// Empty on purpose — real events are added through web-admin's gallery CRUD
// page (/admin/gallery), not seeded here.
function getStore(): GalleryEvent[] {
  if (!globalThis.__galleryEventsStore) {
    globalThis.__galleryEventsStore = [];
  }
  return globalThis.__galleryEventsStore;
}

function setStore(next: GalleryEvent[]): void {
  globalThis.__galleryEventsStore = next;
}

function generateId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Get gallery events, sorted by order. Hidden events are excluded unless includeHidden is passed (admin use). */
export async function getEvents(
  options: { includeHidden?: boolean } = {},
): Promise<GalleryEvent[]> {
  const events = getStore();
  const list = options.includeHidden ? events : events.filter((e) => e.isVisible);
  return [...list].sort((a, b) => a.order - b.order);
}

export async function getEventById(id: string): Promise<GalleryEvent | null> {
  return getStore().find((e) => e.id === id) ?? null;
}

export async function createEvent(
  input: Omit<GalleryEvent, "id" | "order">,
): Promise<GalleryEvent> {
  const events = getStore();
  const maxOrder = events.reduce((max, e) => Math.max(max, e.order), -1);
  const event: GalleryEvent = { ...input, id: generateId(), order: maxOrder + 1 };
  setStore([...events, event]);
  return event;
}

export async function updateEvent(
  id: string,
  patch: Partial<Omit<GalleryEvent, "id">>,
): Promise<GalleryEvent> {
  const events = getStore();
  const index = events.findIndex((e) => e.id === id);
  if (index === -1) throw new Error(`Event not found: ${id}`);
  const updated = { ...events[index], ...patch };
  setStore([...events.slice(0, index), updated, ...events.slice(index + 1)]);
  return updated;
}

export async function deleteEvent(id: string): Promise<void> {
  setStore(getStore().filter((e) => e.id !== id));
}

/** Persist a new left-to-right order given a full list of event ids in the desired order. */
export async function reorderEvents(orderedIds: string[]): Promise<void> {
  const byId = new Map(getStore().map((e) => [e.id, e]));
  setStore(
    orderedIds
      .map((id, index) => {
        const event = byId.get(id);
        if (!event) return null;
        return { ...event, order: index };
      })
      .filter((e): e is GalleryEvent => e !== null),
  );
}
