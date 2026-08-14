import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { CompressionOptions, CompressionResult } from "@/lib/image-compression";

describe("image compression public API", () => {
  it("exports the client function, input limit, and upload-form types", async () => {
    const api = await import("@/lib/image-compression");

    expect(api.compressImage).toEqual(expect.any(Function));
    expect(api.MAX_INPUT_BYTES).toBe(10 * 1024 * 1024);
    expectTypeOf<CompressionOptions>().toEqualTypeOf<{
      maxDimension?: number;
      quality?: number;
      outputType?: "image/jpeg" | "image/png" | "image/webp";
    }>();
    expectTypeOf<CompressionResult>().toEqualTypeOf<{
      blob: Blob;
      originalSize: number;
      compressedSize: number;
      width: number;
      height: number;
      mimeType: string;
    }>();
  });

  it("imports in Node without accessing browser globals or constructing a Worker", async () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const originalWorker = Object.getOwnPropertyDescriptor(globalThis, "Worker");
    const browserGlobalAccess = vi.fn((name: string): never => {
      throw new Error(`Accessed browser global during import: ${name}`);
    });

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      get: () => browserGlobalAccess("window"),
    });
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      get: () => browserGlobalAccess("Worker"),
    });
    vi.resetModules();

    try {
      await expect(import("@/lib/image-compression")).resolves.toBeDefined();
      expect(browserGlobalAccess).not.toHaveBeenCalled();
    } finally {
      if (originalWindow) {
        Object.defineProperty(globalThis, "window", originalWindow);
      } else {
        delete (globalThis as { window?: unknown }).window;
      }
      if (originalWorker) {
        Object.defineProperty(globalThis, "Worker", originalWorker);
      } else {
        delete (globalThis as { Worker?: unknown }).Worker;
      }
    }
  });
});
