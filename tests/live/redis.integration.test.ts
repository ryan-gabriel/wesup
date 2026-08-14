import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Redis } from "@upstash/redis";

const noRedisUrl =
  !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN;

describe.skipIf(noRedisUrl)("live Upstash Redis", () => {
  let redis: Redis;
  const keys: string[] = [];

  const key = (name: string) => {
    const full = `test:setup:${name}:${Date.now()}`;
    keys.push(full);
    return full;
  };

  beforeAll(async () => {
    const mod = await import("@/lib/redis");
    redis = mod.redis;
  });

  afterAll(async () => {
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe("connection", () => {
    it("answers PING", async () => {
      await expect(redis.ping()).resolves.toBe("PONG");
    });
  });

  describe("basic operations", () => {
    it("round-trips a string through SET, GET, DEL", async () => {
      const k = key("roundtrip");
      await expect(redis.set(k, "value")).resolves.toBe("OK");
      await expect(redis.get(k)).resolves.toBe("value");
      await expect(redis.del(k)).resolves.toBe(1);
      await expect(redis.get(k)).resolves.toBeNull();
    });
  });

  describe("atomic counter (tier volume)", () => {
    it("increments sequentially from an empty key", async () => {
      const k = key("incr");
      await expect(redis.incr(k)).resolves.toBe(1);
      await expect(redis.incr(k)).resolves.toBe(2);
      await expect(redis.incr(k)).resolves.toBe(3);
    });
  });

  describe("distributed lock (gatekeeper)", () => {
    it("acquires with SET NX and rejects a second contender", async () => {
      const k = key("lock");
      await expect(redis.set(k, "holder", { nx: true })).resolves.toBe("OK");
      await expect(redis.set(k, "other", { nx: true })).resolves.toBeNull();
    });

    it("releases the lock with DEL and allows re-acquire", async () => {
      const k = key("lock-release");
      await expect(redis.set(k, "holder", { nx: true })).resolves.toBe("OK");
      await expect(redis.del(k)).resolves.toBe(1);
      await expect(redis.set(k, "next", { nx: true })).resolves.toBe("OK");
    });
  });
});
