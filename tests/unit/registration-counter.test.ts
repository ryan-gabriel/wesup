import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { incrbyMock, getMock, setMock, evalMock, delMock } = vi.hoisted(() => ({
  incrbyMock: vi.fn(),
  getMock: vi.fn(),
  setMock: vi.fn(),
  evalMock: vi.fn(),
  delMock: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    incrby: incrbyMock,
    get: getMock,
    set: setMock,
    eval: evalMock,
    del: delMock,
  },
}));

import {
  incrementVolumeCounter,
  decrementVolumeCounter,
  adjustVolumeCounter,
  getVolumeCounter,
  restoreVolumeCounter,
  resetVolumeCounter,
  acquireCutoffLock,
  releaseCutoffLock,
} from "@/lib/orders/registration-counter";

const BATCH_ID = "44444444-4444-4444-8444-444444444444";

describe("incrementVolumeCounter (Redis atomic INCR)", () => {
  beforeEach(() => {
    incrbyMock.mockReset();
  });

  it("increments the per-batch counter and returns the new count", async () => {
    incrbyMock.mockResolvedValue(42);
    const count = await incrementVolumeCounter(BATCH_ID);
    expect(count).toBe(42);
    expect(incrbyMock).toHaveBeenCalledWith(`batch:${BATCH_ID}:count`, 1);
  });
});

describe("decrementVolumeCounter (rollback on failed insert)", () => {
  beforeEach(() => {
    incrbyMock.mockReset();
  });

  it("decrements the per-batch counter and returns the new count", async () => {
    incrbyMock.mockResolvedValue(8);
    const count = await decrementVolumeCounter(BATCH_ID);
    expect(count).toBe(8);
    expect(incrbyMock).toHaveBeenCalledWith(`batch:${BATCH_ID}:count`, -1);
  });
});

describe("adjustVolumeCounter (quantity-aware atomic INCRBY)", () => {
  beforeEach(() => {
    incrbyMock.mockReset();
  });

  it("increments by the requested registration quantity", async () => {
    incrbyMock.mockResolvedValue(17);
    await expect(adjustVolumeCounter(BATCH_ID, 5)).resolves.toBe(17);
    expect(incrbyMock).toHaveBeenCalledWith(`batch:${BATCH_ID}:count`, 5);
  });

  it.each([0, Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1])(
    "rejects an invalid delta (%s) before touching Redis",
    async (delta) => {
      await expect(adjustVolumeCounter(BATCH_ID, delta)).rejects.toThrow(
        "quantityDelta must be a non-zero safe integer",
      );
      expect(incrbyMock).not.toHaveBeenCalled();
    },
  );
});

describe("resetVolumeCounter (post-cutoff cleanup)", () => {
  beforeEach(() => {
    delMock.mockReset();
  });

  it("removes the per-batch volume key after a successful cutoff", async () => {
    delMock.mockResolvedValue(1);
    await resetVolumeCounter(BATCH_ID);
    expect(delMock).toHaveBeenCalledWith(`batch:${BATCH_ID}:count`);
  });
});

describe("getVolumeCounter", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("returns the current counter value", async () => {
    getMock.mockResolvedValue(7);
    await expect(getVolumeCounter(BATCH_ID)).resolves.toBe(7);
    expect(getMock).toHaveBeenCalledWith(`batch:${BATCH_ID}:count`);
  });

  it("returns null when the counter key is missing", async () => {
    getMock.mockResolvedValue(null);
    await expect(getVolumeCounter(BATCH_ID)).resolves.toBeNull();
  });
});

describe("restoreVolumeCounter", () => {
  beforeEach(() => {
    setMock.mockReset();
  });

  it("hydrates a missing key from an authoritative aggregate", async () => {
    setMock.mockResolvedValue("OK");
    await restoreVolumeCounter(BATCH_ID, 23);
    expect(setMock).toHaveBeenCalledWith(`batch:${BATCH_ID}:count`, 23);
  });
});

describe("acquireCutoffLock (Redis SETNX distributed lock)", () => {
  const LOCK_KEY = `cutoff-lock:${BATCH_ID}`;

  beforeEach(() => {
    setMock.mockReset();
    delMock.mockReset();
    evalMock.mockReset();
  });

  it("acquires with SET NX + owner token + TTL when uncontested", async () => {
    setMock.mockResolvedValue("OK");
    const acquired = await acquireCutoffLock(BATCH_ID);
    expect(acquired.acquired).toBe(true);
    expect(acquired.token).toBeTruthy();
    expect(setMock).toHaveBeenCalledWith(
      LOCK_KEY,
      acquired.token,
      expect.objectContaining({ nx: true, ex: expect.any(Number) }),
    );
  });

  it("reports not acquired when another holder owns the lock", async () => {
    setMock.mockResolvedValue(null);
    const acquired = await acquireCutoffLock(BATCH_ID);
    expect(acquired.acquired).toBe(false);
    expect(acquired.token).toBe("");
  });

  it("uses a distinct owner token per acquisition (contention safety)", async () => {
    setMock.mockResolvedValue("OK");
    const a = await acquireCutoffLock(BATCH_ID);
    const b = await acquireCutoffLock(BATCH_ID);
    expect(a.token).toBeTruthy();
    expect(b.token).toBeTruthy();
    expect(a.token).not.toBe(b.token);
  });
});

describe("releaseCutoffLock (compare-and-delete, owner only)", () => {
  const LOCK_KEY = `cutoff-lock:${BATCH_ID}`;
  const token = "owner-token";

  beforeEach(() => {
    evalMock.mockReset();
  });

  it("releases only when the caller token matches via Lua compare-and-del", async () => {
    evalMock.mockResolvedValue(1);
    await releaseCutoffLock(BATCH_ID, token);
    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('get'"),
      [LOCK_KEY],
      [token],
    );
  });

  it("does not delete when the lock belongs to another owner", async () => {
    evalMock.mockResolvedValue(0);
    await releaseCutoffLock(BATCH_ID, token);
    expect(evalMock).toHaveBeenCalled();
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
