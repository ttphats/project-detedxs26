import { NextResponse } from "next/server";

/**
 * The gallery admin CRUD page lives in web-admin (a separate app/origin,
 * localhost:3002 in dev) and calls these routes directly from the browser —
 * so, unlike same-origin app routes elsewhere in web-client, they need CORS
 * headers or every request just fails with a generic "Failed to fetch".
 */
const ALLOWED_ORIGIN = process.env.ADMIN_ORIGIN || "http://localhost:3002";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function withCors(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export function corsPreflight(): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }));
}
