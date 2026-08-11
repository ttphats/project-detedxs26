import { NextRequest, NextResponse } from "next/server";
import {
  createEvent,
  deleteEvent,
  getEventById,
  getEvents,
  updateEvent,
  type GalleryEvent,
} from "@/lib/events";
import { corsPreflight, withCors } from "@/lib/cors";

export function OPTIONS() {
  return corsPreflight();
}

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 600;

// NOTE: id-scoped operations (PATCH/DELETE below) deliberately use a
// `?id=` query param on this same static path instead of a `/[id]` dynamic
// segment. next.config.ts's catch-all `/api/:path*` rewrite to the Fastify
// backend runs as an "afterFiles" rewrite, which Next.js checks *before*
// dynamic App Router routes but *after* static/literal ones — so a
// `/api/gallery/[id]` route would silently lose to that rewrite for any id
// that isn't a literal path Next already knows about. Static paths aren't
// affected by that ordering, so everything here stays on one literal route.
// Only Title, Description, Poster (imageUrl), and visibility are truly
// required — Date and Alt text are optional and default below (matching
// what the admin form already assumes when it omits them).
function validateEventInput(
  body: Partial<GalleryEvent>,
): string | null {
  if (!body.title || !body.title.trim()) return "Title is required.";
  if (body.title.length > TITLE_MAX) return `Title must be at most ${TITLE_MAX} characters.`;
  if (!body.description || !body.description.trim()) return "Description is required.";
  if (body.description.length > DESCRIPTION_MAX)
    return `Description must be at most ${DESCRIPTION_MAX} characters.`;
  if (!body.imageUrl || !body.imageUrl.trim()) return "A poster image is required.";
  return null;
}

function validatePatch(body: Partial<GalleryEvent>): string | null {
  if (body.title !== undefined) {
    if (!body.title.trim()) return "Title is required.";
    if (body.title.length > TITLE_MAX) return `Title must be at most ${TITLE_MAX} characters.`;
  }
  if (body.description !== undefined) {
    if (!body.description.trim()) return "Description is required.";
    if (body.description.length > DESCRIPTION_MAX)
      return `Description must be at most ${DESCRIPTION_MAX} characters.`;
  }
  if (body.imageUrl !== undefined && !body.imageUrl.trim()) return "A poster image is required.";
  return null;
}

// GET /api/gallery?includeHidden=true — admin CRUD (web-admin) uses this to
// see everything; the public web-client page reads lib/events.ts directly
// server-side instead of round-tripping through this route.
export async function GET(request: NextRequest) {
  const includeHidden = request.nextUrl.searchParams.get("includeHidden") !== "false";
  const events = await getEvents({ includeHidden });
  return withCors(NextResponse.json({ success: true, data: events }));
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<GalleryEvent>;
  const error = validateEventInput(body);
  if (error) {
    return withCors(NextResponse.json({ success: false, error }, { status: 400 }));
  }

  const event = await createEvent({
    title: body.title!.trim(),
    description: body.description!.trim(),
    date: body.date || new Date().toISOString().slice(0, 10),
    imageUrl: body.imageUrl!.trim(),
    imageAlt: body.imageAlt?.trim() || body.title!.trim(),
    focalPoint: body.focalPoint ?? { x: 0.5, y: 0.5 },
    zoom: body.zoom ?? 1,
    tags: body.tags ?? [],
    isVisible: body.isVisible ?? true,
  });

  return withCors(NextResponse.json({ success: true, data: event }, { status: 201 }));
}

export async function PATCH(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return withCors(NextResponse.json({ success: false, error: "Missing id" }, { status: 400 }));
  }

  const existing = await getEventById(id);
  if (!existing) {
    return withCors(
      NextResponse.json({ success: false, error: "Event not found" }, { status: 404 }),
    );
  }

  const body = (await request.json()) as Partial<GalleryEvent>;
  const error = validatePatch(body);
  if (error) {
    return withCors(NextResponse.json({ success: false, error }, { status: 400 }));
  }

  const updated = await updateEvent(id, body);
  return withCors(NextResponse.json({ success: true, data: updated }));
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return withCors(NextResponse.json({ success: false, error: "Missing id" }, { status: 400 }));
  }

  const existing = await getEventById(id);
  if (!existing) {
    return withCors(
      NextResponse.json({ success: false, error: "Event not found" }, { status: 404 }),
    );
  }

  await deleteEvent(id);
  return withCors(NextResponse.json({ success: true, data: { id } }));
}
