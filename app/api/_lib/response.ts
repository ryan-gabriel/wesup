import { NextResponse } from "next/server";

interface ApiMeta {
  timestamp: string;
  requestId: string;
}

function makeMeta(): ApiMeta {
  return {
    timestamp: new Date().toISOString(),
    requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
  };
}

/**
 * Standardized success response.
 */
export function apiSuccess(data: unknown, status: number = 200): NextResponse {
  return NextResponse.json(
    { success: true, data, meta: makeMeta() },
    { status },
  );
}

/**
 * Standardized error response.
 */
export function apiError(
  code: string,
  message: string,
  status: number = 400,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, ...(details ? { details } : {}) },
      meta: makeMeta(),
    },
    { status },
  );
}

/**
 * Rate-limited response (429).
 */
export function apiRateLimit(retryAfter: number): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Terlalu banyak request. Mohon tunggu.",
        retryAfter,
      },
    },
    { status: 429 },
  );
}

/**
 * Resource locked response (423).
 */
export function apiLocked(message?: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "RESOURCE_LOCKED",
        message: message ?? "Resource sedang diproses. Mohon tunggu beberapa saat.",
      },
    },
    { status: 423 },
  );
}
