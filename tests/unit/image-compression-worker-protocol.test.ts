import { describe, expect, it, vi } from "vitest";
import {
  handleCompressionWorkerMessage,
  processCompressionWorkerRequest,
  type CompressionWorkerRuntime,
} from "@/lib/image-compression/image-compression.worker";
import {
  createCompressionWorkerFailure,
  createCompressionWorkerRequest,
  createCompressionWorkerSuccess,
  isCompressionWorkerRequest,
  isCompressionWorkerResponse,
  parseCompressionWorkerResponse,
  workerErrorToFailure,
} from "@/lib/image-compression/worker-protocol";
import { MAX_INPUT_BYTES } from "@/lib/image-compression/validation";

function imageFile(size = 1_024, type = "image/png") {
  return new File([new Uint8Array(size)], "source.png", { type });
}

function successfulRuntime(overrides: Partial<CompressionWorkerRuntime> = {}): CompressionWorkerRuntime {
  return {
    createImageBitmap: vi.fn().mockResolvedValue({ width: 800, height: 600, close: vi.fn() }),
    createCanvas: vi.fn().mockReturnValue({
      getContext: () => ({ drawImage: vi.fn() }),
      convertToBlob: vi.fn().mockResolvedValue(new Blob(["compressed"], { type: "image/jpeg" })),
    }),
    ...overrides,
  };
}

describe("image compression worker protocol", () => {
  it("preserves the request ID in request and success messages", () => {
    const file = imageFile();
    const request = createCompressionWorkerRequest("request-17", file, { quality: 0.6 });
    const result = {
      blob: new Blob(["compressed"], { type: "image/webp" }),
      originalSize: 1_024,
      compressedSize: 10,
      width: 800,
      height: 600,
      mimeType: "image/webp",
    };

    expect(request).toEqual({ id: "request-17", file, options: { quality: 0.6 } });
    expect(createCompressionWorkerSuccess(request.id, result)).toEqual({ id: "request-17", ok: true, result });
    expect(isCompressionWorkerRequest(request)).toBe(true);
    expect(isCompressionWorkerResponse(createCompressionWorkerSuccess(request.id, result))).toBe(true);
  });

  it("preserves the request ID and typed code in failure messages", () => {
    const failure = createCompressionWorkerFailure("request-18", "ENCODE_FAILED", "Encoding failed");

    expect(failure).toEqual({ id: "request-18", ok: false, code: "ENCODE_FAILED", message: "Encoding failed" });
    expect(isCompressionWorkerResponse(failure)).toBe(true);
  });

  it("converts an unknown worker error into a WORKER_FAILED response", () => {
    expect(workerErrorToFailure("request-19", new Error("worker crashed"))).toEqual({
      id: "request-19",
      ok: false,
      code: "WORKER_FAILED",
      message: "worker crashed",
    });
  });

  it("turns a malformed response into a typed failure without exposing a raw error", () => {
    expect(parseCompressionWorkerResponse({ id: "wrong", ok: true }, "request-20")).toEqual({
      id: "request-20",
      ok: false,
      code: "WORKER_FAILED",
      message: "Worker returned an invalid response",
    });
    expect(isCompressionWorkerResponse({ id: "request-20", ok: false, code: "UNKNOWN", message: "bad" })).toBe(
      false,
    );
  });

  it("rejects plain objects masquerading as structured-clone File and Blob values", () => {
    const fakeSuccess = {
      id: "request-22",
      ok: true,
      result: {
        blob: { size: 10, type: "image/webp" },
        originalSize: 1_024,
        compressedSize: 10,
        width: 800,
        height: 600,
        mimeType: "image/webp",
      },
    };

    expect(isCompressionWorkerRequest({ id: "request-22", file: { size: 1_024, type: "image/png" }, options: {} })).toBe(
      false,
    );
    expect(isCompressionWorkerResponse(fakeSuccess)).toBe(false);
    expect(parseCompressionWorkerResponse(fakeSuccess, "request-22")).toEqual({
      id: "request-22",
      ok: false,
      code: "WORKER_FAILED",
      message: "Worker returned an invalid response",
    });
  });
});

describe("processCompressionWorkerRequest", () => {
  it("resizes proportionally, encodes the requested type, and closes the bitmap", async () => {
    const close = vi.fn();
    const drawImage = vi.fn();
    const convertToBlob = vi.fn().mockResolvedValue(new Blob(["compressed"], { type: "image/webp" }));
    const createCanvas = vi.fn().mockReturnValue({ getContext: () => ({ drawImage }), convertToBlob });
    const response = await processCompressionWorkerRequest(
      createCompressionWorkerRequest("request-21", imageFile(4_096), {
        maxDimension: 1_000,
        quality: 0.7,
        outputType: "image/webp",
      }),
      successfulRuntime({
        createImageBitmap: vi.fn().mockResolvedValue({ width: 4_000, height: 2_000, close }),
        createCanvas,
      }),
    );

    expect(response).toEqual({
      id: "request-21",
      ok: true,
      result: {
        blob: expect.any(Blob),
        originalSize: 4_096,
        compressedSize: 10,
        width: 1_000,
        height: 500,
        mimeType: "image/webp",
      },
    });
    expect(createCanvas).toHaveBeenCalledWith(1_000, 500);
    expect(drawImage).toHaveBeenCalledWith(expect.objectContaining({ width: 4_000, height: 2_000 }), 0, 0, 1_000, 500);
    expect(convertToBlob).toHaveBeenCalledWith({ type: "image/webp", quality: 0.7 });
    expect(close).toHaveBeenCalledOnce();
  });

  it("does not upscale an image smaller than the maximum dimension", async () => {
    const createCanvas = vi.fn().mockReturnValue({
      getContext: () => ({ drawImage: vi.fn() }),
      convertToBlob: vi.fn().mockResolvedValue(new Blob(["compressed"], { type: "image/jpeg" })),
    });
    const response = await processCompressionWorkerRequest(
      createCompressionWorkerRequest("no-upscale-id", imageFile(), { maxDimension: 2_000 }),
      successfulRuntime({
        createImageBitmap: vi.fn().mockResolvedValue({ width: 640, height: 480, close: vi.fn() }),
        createCanvas,
      }),
    );

    expect(response).toEqual(expect.objectContaining({
      ok: true,
      result: expect.objectContaining({ width: 640, height: 480 }),
    }));
    expect(createCanvas).toHaveBeenCalledWith(640, 480);
  });

  it("resizes portrait images proportionally", async () => {
    const createCanvas = vi.fn().mockReturnValue({
      getContext: () => ({ drawImage: vi.fn() }),
      convertToBlob: vi.fn().mockResolvedValue(new Blob(["compressed"], { type: "image/jpeg" })),
    });
    const response = await processCompressionWorkerRequest(
      createCompressionWorkerRequest("portrait-id", imageFile(), { maxDimension: 1_000 }),
      successfulRuntime({
        createImageBitmap: vi.fn().mockResolvedValue({ width: 1_200, height: 2_400, close: vi.fn() }),
        createCanvas,
      }),
    );

    expect(response).toEqual(expect.objectContaining({
      ok: true,
      result: expect.objectContaining({ width: 500, height: 1_000 }),
    }));
    expect(createCanvas).toHaveBeenCalledWith(500, 1_000);
  });

  it("returns ENCODE_FAILED when the browser falls back to a different output MIME", async () => {
    const close = vi.fn();
    const response = await processCompressionWorkerRequest(
      createCompressionWorkerRequest("mime-fallback-id", imageFile(), { outputType: "image/webp" }),
      successfulRuntime({
        createImageBitmap: vi.fn().mockResolvedValue({ width: 800, height: 600, close }),
        createCanvas: vi.fn().mockReturnValue({
          getContext: () => ({ drawImage: vi.fn() }),
          convertToBlob: vi.fn().mockResolvedValue(new Blob(["fallback"], { type: "image/png" })),
        }),
      }),
    );

    expect(response).toEqual({
      id: "mime-fallback-id",
      ok: false,
      code: "ENCODE_FAILED",
      message: "Browser returned image/png instead of requested image/webp",
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("returns DECODE_FAILED when image decoding fails", async () => {
    const response = await processCompressionWorkerRequest(
      createCompressionWorkerRequest("decode-id", imageFile(), {}),
      successfulRuntime({ createImageBitmap: vi.fn().mockRejectedValue(new Error("corrupt image")) }),
    );

    expect(response).toEqual({ id: "decode-id", ok: false, code: "DECODE_FAILED", message: "corrupt image" });
  });

  it("closes an acquired bitmap whose decoded dimensions are invalid", async () => {
    const close = vi.fn();
    const response = await processCompressionWorkerRequest(
      createCompressionWorkerRequest("invalid-dimensions-id", imageFile(), {}),
      successfulRuntime({ createImageBitmap: vi.fn().mockResolvedValue({ width: 0, height: 600, close }) }),
    );

    expect(response).toEqual({
      id: "invalid-dimensions-id",
      ok: false,
      code: "DECODE_FAILED",
      message: "Decoded image has invalid dimensions",
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it.each([
    {
      name: "oversized input",
      id: "oversized-id",
      file: imageFile(MAX_INPUT_BYTES + 1),
      options: {},
      code: "INPUT_TOO_LARGE",
      message: "Image must not exceed 10 MiB",
    },
    {
      name: "invalid options",
      id: "invalid-options-id",
      file: imageFile(),
      options: { quality: Number.NaN },
      code: "INVALID_OPTIONS",
      message: "Quality must be between 0 and 1",
    },
  ] as const)("rejects $name before decoding", async ({ id, file, options, code, message }) => {
    const createImageBitmap = vi.fn();
    const response = await processCompressionWorkerRequest(
      createCompressionWorkerRequest(id, file, options),
      successfulRuntime({ createImageBitmap }),
    );

    expect(response).toEqual({ id, ok: false, code, message });
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("returns CANVAS_FAILED and closes the bitmap when a 2D context is unavailable", async () => {
    const close = vi.fn();
    const response = await processCompressionWorkerRequest(
      createCompressionWorkerRequest("canvas-id", imageFile(), {}),
      successfulRuntime({
        createImageBitmap: vi.fn().mockResolvedValue({ width: 800, height: 600, close }),
        createCanvas: vi.fn().mockReturnValue({ getContext: () => null, convertToBlob: vi.fn() }),
      }),
    );

    expect(response).toEqual({
      id: "canvas-id",
      ok: false,
      code: "CANVAS_FAILED",
      message: "Unable to create a 2D canvas context",
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("returns ENCODE_FAILED and closes the bitmap when encoding fails", async () => {
    const close = vi.fn();
    const response = await processCompressionWorkerRequest(
      createCompressionWorkerRequest("encode-id", imageFile(), {}),
      successfulRuntime({
        createImageBitmap: vi.fn().mockResolvedValue({ width: 800, height: 600, close }),
        createCanvas: vi.fn().mockReturnValue({
          getContext: () => ({ drawImage: vi.fn() }),
          convertToBlob: vi.fn().mockRejectedValue(new Error("codec unavailable")),
        }),
      }),
    );

    expect(response).toEqual({ id: "encode-id", ok: false, code: "ENCODE_FAILED", message: "codec unavailable" });
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("handleCompressionWorkerMessage", () => {
  it("posts a typed rejection that preserves the ID from an invalid request", async () => {
    const posted: unknown[] = [];
    await handleCompressionWorkerMessage(
      { id: "invalid-request-id", file: { size: 1_024, type: "image/png" }, options: {} },
      (message) => posted.push(structuredClone(message)),
    );

    expect(posted).toEqual([
      {
        id: "invalid-request-id",
        ok: false,
        code: "WORKER_FAILED",
        message: "Worker received an invalid request",
      },
    ]);
    expect(isCompressionWorkerResponse(posted[0])).toBe(true);
  });

  it("posts a structured-clone success response through the Worker boundary", async () => {
    const posted: unknown[] = [];
    await handleCompressionWorkerMessage(
      createCompressionWorkerRequest("boundary-success-id", imageFile(100), {}),
      (message) => posted.push(structuredClone(message)),
      successfulRuntime({
        createImageBitmap: vi.fn().mockResolvedValue({ width: 400, height: 200, close: vi.fn() }),
        createCanvas: vi.fn().mockReturnValue({
          getContext: () => ({ drawImage: vi.fn() }),
          convertToBlob: vi.fn().mockResolvedValue(new Blob(["done"], { type: "image/jpeg" })),
        }),
      }),
    );

    expect(posted).toEqual([
      {
        id: "boundary-success-id",
        ok: true,
        result: {
          blob: expect.any(Blob),
          originalSize: 100,
          compressedSize: 4,
          width: 400,
          height: 200,
          mimeType: "image/jpeg",
        },
      },
    ]);
    expect(isCompressionWorkerResponse(posted[0])).toBe(true);
  });

  it("posts WORKER_FAILED when an unexpected terminal error escapes processing", async () => {
    const posted: unknown[] = [];
    const close = vi.fn();
    const invalidBlob = {
      get size() {
        throw new Error("unexpected serialization failure");
      },
      type: "image/jpeg",
    } as unknown as Blob;

    await handleCompressionWorkerMessage(
      createCompressionWorkerRequest("terminal-error-id", imageFile(), {}),
      (message) => posted.push(message),
      successfulRuntime({
        createImageBitmap: vi.fn().mockResolvedValue({ width: 400, height: 200, close }),
        createCanvas: vi.fn().mockReturnValue({
          getContext: () => ({ drawImage: vi.fn() }),
          convertToBlob: vi.fn().mockResolvedValue(invalidBlob),
        }),
      }),
    );

    expect(posted).toEqual([
      {
        id: "terminal-error-id",
        ok: false,
        code: "WORKER_FAILED",
        message: "unexpected serialization failure",
      },
    ]);
    expect(close).toHaveBeenCalledOnce();
  });
});
