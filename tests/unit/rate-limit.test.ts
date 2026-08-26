import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { evalMock, redisMock } = vi.hoisted(() => {
  const evalMock = vi.fn();
  const redisMock = {
    eval: evalMock,
  };
  return { evalMock, redisMock };
});

vi.mock("@/lib/redis", () => ({
  redis: redisMock,
}));

import { RATE_LIMITS, checkRateLimit, enforceRateLimit } from "@/lib/rate-limit";

function hashIdentifier(identifier: string): string {
  return createHash("sha256")
    .update(identifier.trim().toLowerCase())
    .digest("hex");
}

describe("checkRateLimit (atomic INCR counter)", () => {
  const FIXED_NOW = Date.parse("2026-08-22T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    evalMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("increments a hashed per-identity key with the scope window", async () => {
    evalMock.mockResolvedValue([1, RATE_LIMITS.login.windowSeconds]);

    await checkRateLimit("login", "1.2.3.4");
    const expectedKey = `ratelimit:login:${hashIdentifier("1.2.3.4")}`;

    expect(evalMock).toHaveBeenCalledTimes(1);
    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCR', KEYS[1])"),
      [expectedKey],
      [String(RATE_LIMITS.login.windowSeconds)],
    );
  });

  it("allows when count is within limit and reports remaining", async () => {
    evalMock.mockResolvedValue([3, RATE_LIMITS.login.windowSeconds]);

    const result = await checkRateLimit("login", "1.2.3.4");

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(RATE_LIMITS.login.limit);
    expect(result.remaining).toBe(RATE_LIMITS.login.limit - 3);
  });

  it("blocks when count exceeds limit", async () => {
    evalMock.mockResolvedValue([6, RATE_LIMITS.login.windowSeconds]);

    const result = await checkRateLimit("login", "1.2.3.4");

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("reports resetAt based on the key's remaining TTL", async () => {
    evalMock.mockResolvedValue([2, 30]);

    const result = await checkRateLimit("login", "1.2.3.4");

    expect(result.resetAt).toBe(FIXED_NOW + 30 * 1000);
  });

  it("falls back to the full window when Redis returns no TTL", async () => {
    evalMock.mockResolvedValue([2, -1]);

    const result = await checkRateLimit("login", "1.2.3.4");

    expect(result.resetAt).toBe(FIXED_NOW + RATE_LIMITS.login.windowSeconds * 1000);
  });

  it("fails open when Redis throws", async () => {
    evalMock.mockRejectedValue(new Error("upstash unreachable"));

    const result = await checkRateLimit("login", "1.2.3.4");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(RATE_LIMITS.login.limit);
  });
});

function requestWithIp(ip?: string) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: ip ? { "x-forwarded-for": `${ip}, 10.0.0.1` } : {},
  });
}

describe("enforceRateLimit (route guard)", () => {
  const FIXED_NOW = Date.parse("2026-08-22T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    evalMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when allowed", async () => {
    evalMock.mockResolvedValue([1, RATE_LIMITS.login.windowSeconds]);

    const response = await enforceRateLimit(requestWithIp("8.8.8.8"), "login");

    expect(response).toBeNull();
    expect(evalMock).toHaveBeenCalledWith(
      expect.any(String),
      [`ratelimit:login:${hashIdentifier("8.8.8.8")}`],
      [String(RATE_LIMITS.login.windowSeconds)],
    );
  });

  it("prefers userId over IP as identifier", async () => {
    evalMock.mockResolvedValue([1, RATE_LIMITS.admin.windowSeconds]);

    await enforceRateLimit(requestWithIp("8.8.8.8"), "admin", "user-42");

    expect(evalMock).toHaveBeenCalledWith(
      expect.any(String),
      [`ratelimit:admin:${hashIdentifier("user-42")}`],
      [String(RATE_LIMITS.admin.windowSeconds)],
    );
  });

  it("returns 429 with Retry-After when blocked", async () => {
    evalMock.mockResolvedValue([99, 45]);

    const response = await enforceRateLimit(requestWithIp("8.8.8.8"), "login");

    expect(response).not.toBeNull();
    expect(response!.status).toBe(429);
    const body = await response!.json();
    expect(body.error).toBeTruthy();
    const retryAfter = Number(response!.headers.get("Retry-After"));
    expect(retryAfter).toBe(45);
  });

  it("uses only the first IP from x-forwarded-for", async () => {
    evalMock.mockResolvedValue([1, RATE_LIMITS.search.windowSeconds]);

    await enforceRateLimit(requestWithIp("9.9.9.9"), "search");

    expect(evalMock).toHaveBeenCalledWith(
      expect.any(String),
      [`ratelimit:search:${hashIdentifier("9.9.9.9")}`],
      [String(RATE_LIMITS.search.windowSeconds)],
    );
  });

  it("falls back to x-real-ip then unknown", async () => {
    evalMock.mockResolvedValue([1, RATE_LIMITS.search.windowSeconds]);

    const realIpReq = new NextRequest("http://localhost/x", {
      headers: { "x-real-ip": "7.7.7.7" },
    });
    await enforceRateLimit(realIpReq, "search");
    expect(evalMock).toHaveBeenLastCalledWith(
      expect.any(String),
      [`ratelimit:search:${hashIdentifier("7.7.7.7")}`],
      [String(RATE_LIMITS.search.windowSeconds)],
    );

    const anonReq = new NextRequest("http://localhost/x");
    await enforceRateLimit(anonReq, "search");
    expect(evalMock).toHaveBeenLastCalledWith(
      expect.any(String),
      [`ratelimit:search:${hashIdentifier("unknown")}`],
      [String(RATE_LIMITS.search.windowSeconds)],
    );
  });

  it("fails open when Redis is unreachable", async () => {
    evalMock.mockRejectedValue(new Error("connection refused"));

    const response = await enforceRateLimit(requestWithIp("8.8.8.8"), "login");

    expect(response).toBeNull();
  });
});
