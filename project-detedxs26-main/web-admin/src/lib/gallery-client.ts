/**
 * Client for the gallery data API — which lives in web-client
 * (app/api/gallery/route.ts), not the Fastify backend. The gallery feature's
 * data layer is currently a mock in-memory store inside web-client's process
 * (lib/events.ts); this file is the only thing in web-admin that needs to
 * know that, everything else here just calls these functions.
 *
 * NOTE: GalleryEvent is duplicated from web-client's lib/events.ts by
 * necessity (separate app/package) — keep the two shapes in sync by hand.
 */

const CLIENT_URL = process.env.NEXT_PUBLIC_CLIENT_URL || "http://localhost:3000";

export interface GalleryEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  imageUrl: string;
  imageAlt: string;
  focalPoint: { x: number; y: number };
  zoom: number;
  tags: string[];
  isVisible: boolean;
  order: number;
}

export type GalleryEventInput = Omit<GalleryEvent, "id" | "order">;

async function parseResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data.data as T;
}

export async function fetchGalleryEvents(): Promise<GalleryEvent[]> {
  const res = await fetch(`${CLIENT_URL}/api/gallery?includeHidden=true`, {
    cache: "no-store",
  });
  return parseResponse<GalleryEvent[]>(res);
}

export async function createGalleryEvent(
  input: GalleryEventInput,
): Promise<GalleryEvent> {
  const res = await fetch(`${CLIENT_URL}/api/gallery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseResponse<GalleryEvent>(res);
}

export async function updateGalleryEvent(
  id: string,
  patch: Partial<GalleryEventInput>,
): Promise<GalleryEvent> {
  const res = await fetch(`${CLIENT_URL}/api/gallery?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return parseResponse<GalleryEvent>(res);
}

export async function deleteGalleryEvent(id: string): Promise<void> {
  const res = await fetch(`${CLIENT_URL}/api/gallery?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  await parseResponse<{ id: string }>(res);
}

export async function reorderGalleryEvents(orderedIds: string[]): Promise<void> {
  const res = await fetch(`${CLIENT_URL}/api/gallery/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderedIds }),
  });
  await parseResponse<void>(res);
}
