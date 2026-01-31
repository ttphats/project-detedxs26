/**
 * Catch-all Route Handler - Proxy all API requests to Fastify backend
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000/api";

async function proxyRequest(request: Request, path: string[]) {
  const url = new URL(request.url);
  const backendUrl = `${BACKEND_URL}/${path.join("/")}${url.search}`;

  // Debug log
  console.log(`[PROXY] ${request.method} ${url.pathname} -> ${backendUrl}`);

  // Forward headers
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    // Skip host header
    if (key.toLowerCase() !== "host") {
      headers.set(key, value);
    }
  });

  // Get body for non-GET requests
  let body: BodyInit | null = null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      // For file uploads, pass formData
      body = await request.formData();
      // Remove content-type header so fetch can set it with boundary
      headers.delete("content-type");
    } else {
      body = await request.text();
    }
  }

  try {
    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
    });

    // Get response body
    const contentType = response.headers.get("content-type") || "";
    let responseBody: BodyInit;

    if (contentType.includes("application/json")) {
      responseBody = await response.text();
    } else if (contentType.includes("text/html")) {
      responseBody = await response.text();
    } else {
      responseBody = await response.arrayBuffer();
    }

    // Forward response headers
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      // Skip some headers
      if (!["content-encoding", "transfer-encoding"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[PROXY ERROR] ${backendUrl}:`, error);
    return Response.json(
      { success: false, error: "Backend connection failed" },
      { status: 502 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

