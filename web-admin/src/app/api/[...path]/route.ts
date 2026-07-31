/**
 * Catch-all Route Handler - Proxy all /api/* requests to the Fastify backend.
 * Avoid Next.js rewrites to external HTTPS (fails on self-signed MITM chains).
 */
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const BACKEND_URL = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000/api"
).replace(/\/$/, "");

const isDev = process.env.NODE_ENV !== "production";

function proxyViaNode(
  backendUrl: string,
  method: string,
  headers: Record<string, string>,
  body: Buffer | undefined,
): Promise<{
  status: number;
  statusText: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(backendUrl);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers,
        // Dev-only: corporate TLS intercept / incomplete chain
        rejectUnauthorized: !(isDev && parsed.protocol === "https:"),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) =>
          chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
        );
        res.on("end", () => {
          resolve({
            status: res.statusCode || 502,
            statusText: res.statusMessage || "",
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on("error", reject);
    if (body && body.length) req.write(body);
    req.end();
  });
}

async function proxyRequest(request: Request, path: string[]) {
  const url = new URL(request.url);
  const backendUrl = `${BACKEND_URL}/${path.join("/")}${url.search}`;
  console.log(`[PROXY] ${request.method} ${url.pathname} -> ${backendUrl}`);

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    // Drop hop-by-hop + encoding so upstream returns plain body we can forward.
    if (
      k === "host" ||
      k === "connection" ||
      k === "content-length" ||
      k === "accept-encoding" ||
      k === "content-encoding"
    ) {
      return;
    }
    headers[key] = value;
  });
  // Force uncompressed response — Node does not auto-decode gzip for us.
  headers["accept-encoding"] = "identity";

  let bodyBuf: Buffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const ab = await request.arrayBuffer();
    bodyBuf = Buffer.from(ab);
    if (bodyBuf.length) headers["content-length"] = String(bodyBuf.length);
  }

  try {
    const upstream = await proxyViaNode(
      backendUrl,
      request.method,
      headers,
      bodyBuf,
    );

    const responseHeaders = new Headers();
    for (const [key, value] of Object.entries(upstream.headers)) {
      if (!value) continue;
      const k = key.toLowerCase();
      if (
        k === "content-encoding" ||
        k === "transfer-encoding" ||
        k === "connection" ||
        k === "content-length"
      ) {
        continue;
      }
      if (Array.isArray(value)) value.forEach((v) => responseHeaders.append(key, v));
      else responseHeaders.set(key, value);
    }
    responseHeaders.set("content-length", String(upstream.body.length));

    return new Response(new Uint8Array(upstream.body), {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[PROXY ERROR] ${backendUrl}:`, message);
    return Response.json(
      {
        success: false,
        error: isDev
          ? `Backend connection failed: ${message}`
          : "Backend connection failed",
      },
      { status: 502 },
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path);
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path);
}
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path);
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path);
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path);
}
