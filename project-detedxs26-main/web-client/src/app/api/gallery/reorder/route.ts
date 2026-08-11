import { NextRequest, NextResponse } from "next/server";
import { reorderEvents } from "@/lib/events";
import { corsPreflight, withCors } from "@/lib/cors";

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { orderedIds?: string[] };
  if (!body.orderedIds || !Array.isArray(body.orderedIds)) {
    return withCors(
      NextResponse.json(
        { success: false, error: "orderedIds must be an array of event ids." },
        { status: 400 },
      ),
    );
  }

  await reorderEvents(body.orderedIds);
  return withCors(NextResponse.json({ success: true }));
}
