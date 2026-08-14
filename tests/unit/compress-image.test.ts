import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compressImage, CompressionError } from "@/lib/image-compression";
import { MAX_INPUT_BYTES } from "@/lib/image-compression/validation";
import type { CompressionWorkerRequest } from "@/lib/image-compression/worker-protocol";

type WorkerEventType = "message" | "messageerror" | "error";
type WorkerListener = (event: MessageEvent<unknown> | ErrorEvent) => void;

class FakeWorker {
  static instances: FakeWorker[] = [];

  readonly listeners = new Map<WorkerEventType, Set<WorkerListener>>();
  readonly posted: unknown[] = [];
  readonly terminate = vi.fn();

  constructor(
    readonly url: URL,
    readonly options: WorkerOptions,
  ) {
    FakeWorker.instances.push(this);
  }

  addEventListener(type: WorkerEventType, listener: WorkerListener) {
    const listeners = this.listeners.get(type) ?? new Set<WorkerListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: WorkerEventType, listener: WorkerListener) {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(message: unknown) {
    this.posted.push(message);
  }

  emit(type: WorkerEventType, event: MessageEvent<unknown> | ErrorEvent) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener(event);
    }
  }

  listenerCount() {
    return [...this.listeners.values()].reduce((count, listeners) => count + listeners.size, 0);
  }
}

function imageFile(size = 1_024, type = "image/png") {
  return new File([new Uint8Array(size)], "source.png", { type });
}

function postedRequest(worker: FakeWorker) {
  return worker.posted[0] as CompressionWorkerRequest;
}

function compressionResult(label: string, originalSize = 1_024) {
  const blob = new Blob([label], { type: "image/webp" });
  return {
    blob,
    originalSize,
    compressedSize: blob.size,
    width: 800,
    height: 600,
    mimeType: "image/webp",
  };
}

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal("window", {});
  vi.stubGlobal("Worker", FakeWorker);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("compressImage", () => {
  it.each([
    {
      name: "oversized input",
      file: imageFile(MAX_INPUT_BYTES + 1),
      options: undefined,
      code: "INPUT_TOO_LARGE",
    },
    {
      name: "invalid compression options",
      file: imageFile(),
      options: { quality: Number.NaN },
      code: "INVALID_OPTIONS",
    },
    {
      name: "unsupported runtime output MIME",
      file: imageFile(),
      options: { outputType: "image/gif" } as never,
      code: "INVALID_OPTIONS",
    },
  ] as const)("rejects $name before constructing a Worker", async ({ file, options, code }) => {
    await expect(compressImage(file, options)).rejects.toEqual(expect.objectContaining({ code }));

    expect(FakeWorker.instances).toHaveLength(0);
  });

  it.each([
    { name: "zero", timeoutMs: 0 },
    { name: "negative", timeoutMs: -1 },
    { name: "NaN", timeoutMs: Number.NaN },
    { name: "infinite", timeoutMs: Number.POSITIVE_INFINITY },
  ])("rejects a $name timeout before constructing a Worker", async ({ timeoutMs }) => {
    await expect(compressImage(imageFile(), { timeoutMs })).rejects.toEqual(
      expect.objectContaining({ code: "INVALID_OPTIONS" }),
    );

    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("resolves a matching success response and posts normalized options to a module Worker", async () => {
    const controller = new AbortController();
    const promise = compressImage(imageFile(), { quality: 0.7, signal: controller.signal });
    const worker = FakeWorker.instances[0];
    const request = postedRequest(worker);
    const result = compressionResult("compressed");

    expect(request.file).toBeInstanceOf(File);
    expect(request.options).toEqual({ maxDimension: 2_000, quality: 0.7, outputType: "image/jpeg" });
    expect(worker.url.pathname).toMatch(/image-compression\.worker\.ts$/);
    expect(worker.options).toEqual({ type: "module" });

    worker.emit("message", new MessageEvent("message", { data: { id: request.id, ok: true, result } }));

    await expect(promise).resolves.toEqual(result);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.listenerCount()).toBe(0);

    controller.abort();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("posts defaults for compression fields that are explicitly undefined", async () => {
    const promise = compressImage(imageFile(), {
      maxDimension: undefined,
      quality: undefined,
      outputType: undefined,
    });
    const worker = FakeWorker.instances[0];
    const request = postedRequest(worker);
    const result = compressionResult("defaults");

    expect(request.options).toEqual({ maxDimension: 2_000, quality: 0.82, outputType: "image/jpeg" });

    worker.emit("message", new MessageEvent("message", { data: { id: request.id, ok: true, result } }));
    await expect(promise).resolves.toEqual(result);
  });

  it("converts a Worker-constructor failure into WORKER_FAILED", async () => {
    class ConstructorFailureWorker {
      constructor() {
        throw new Error("Worker construction failed");
      }
    }
    vi.stubGlobal("Worker", ConstructorFailureWorker);

    await expect(compressImage(imageFile())).rejects.toEqual(
      expect.objectContaining({ code: "WORKER_FAILED", message: "Worker construction failed" }),
    );
  });

  it("rejects a matching worker failure with its typed code and cleans up", async () => {
    const promise = compressImage(imageFile());
    const worker = FakeWorker.instances[0];
    const request = postedRequest(worker);

    worker.emit(
      "message",
      new MessageEvent("message", {
        data: { id: request.id, ok: false, code: "ENCODE_FAILED", message: "Codec unavailable" },
      }),
    );

    await expect(promise).rejects.toEqual(
      expect.objectContaining({ name: "CompressionError", code: "ENCODE_FAILED", message: "Codec unavailable" }),
    );
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.listenerCount()).toBe(0);
  });

  it("rejects an already-aborted request without constructing a Worker", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(compressImage(imageFile(), { signal: controller.signal })).rejects.toEqual(
      expect.objectContaining({ code: "ABORTED" }),
    );
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("aborts an in-flight request with ABORTED and terminates the Worker", async () => {
    const controller = new AbortController();
    const promise = compressImage(imageFile(), { signal: controller.signal });
    const worker = FakeWorker.instances[0];

    controller.abort();

    await expect(promise).rejects.toEqual(expect.objectContaining({ code: "ABORTED" }));
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.listenerCount()).toBe(0);
  });

  it("times out after the default 30 seconds with WORKER_TIMEOUT and cleans up", async () => {
    vi.useFakeTimers();
    const promise = compressImage(imageFile());
    const rejection = expect(promise).rejects.toEqual(expect.objectContaining({ code: "WORKER_TIMEOUT" }));
    const worker = FakeWorker.instances[0];

    await vi.advanceTimersByTimeAsync(29_999);
    expect(worker.terminate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    await rejection;
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.listenerCount()).toBe(0);
  });

  it("honors a valid custom timeout", async () => {
    vi.useFakeTimers();
    const promise = compressImage(imageFile(), { timeoutMs: 1_234 });
    const rejection = expect(promise).rejects.toEqual(expect.objectContaining({ code: "WORKER_TIMEOUT" }));
    const worker = FakeWorker.instances[0];

    await vi.advanceTimersByTimeAsync(1_233);
    expect(worker.terminate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await rejection;
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.listenerCount()).toBe(0);
  });

  it.each([
    { name: "malformed", response: { unexpected: true } },
    { name: "mismatched", response: { id: "another-request", ok: false, code: "ABORTED", message: "wrong" } },
  ])("rejects a $name response as WORKER_FAILED and cleans up", async ({ response }) => {
    const promise = compressImage(imageFile());
    const worker = FakeWorker.instances[0];

    worker.emit("message", new MessageEvent("message", { data: response }));

    await expect(promise).rejects.toEqual(expect.objectContaining({ code: "WORKER_FAILED" }));
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.listenerCount()).toBe(0);
  });

  it("converts a Worker runtime error into WORKER_FAILED and cleans up", async () => {
    const promise = compressImage(imageFile());
    const worker = FakeWorker.instances[0];

    worker.emit("error", { message: "Worker crashed" } as ErrorEvent);

    await expect(promise).rejects.toEqual(
      expect.objectContaining({ code: "WORKER_FAILED", message: "Worker crashed" }),
    );
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.listenerCount()).toBe(0);
  });

  it("rejects an unreadable Worker message with WORKER_FAILED and cleans up", async () => {
    const promise = compressImage(imageFile());
    const worker = FakeWorker.instances[0];

    worker.emit("messageerror", new MessageEvent("messageerror"));

    await expect(promise).rejects.toEqual(expect.objectContaining({ code: "WORKER_FAILED" }));
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.listenerCount()).toBe(0);
  });

  it("rejects a synchronous postMessage failure with WORKER_FAILED and cleans up", async () => {
    class ThrowingWorker extends FakeWorker {
      override postMessage() {
        throw new Error("Structured clone failed");
      }
    }
    vi.stubGlobal("Worker", ThrowingWorker);

    const promise = compressImage(imageFile());
    const worker = FakeWorker.instances[0];

    await expect(promise).rejects.toEqual(
      expect.objectContaining({ code: "WORKER_FAILED", message: "Structured clone failed" }),
    );
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.listenerCount()).toBe(0);
  });

  it("does not cross-resolve concurrent calls", async () => {
    const firstPromise = compressImage(imageFile(1_024));
    const secondPromise = compressImage(imageFile(2_048));
    const [firstWorker, secondWorker] = FakeWorker.instances;
    const firstRequest = postedRequest(firstWorker);
    const secondRequest = postedRequest(secondWorker);
    const firstResult = compressionResult("first", 1_024);
    const secondResult = compressionResult("second", 2_048);
    let firstSettled = false;
    void firstPromise.finally(() => {
      firstSettled = true;
    });

    secondWorker.emit(
      "message",
      new MessageEvent("message", { data: { id: secondRequest.id, ok: true, result: secondResult } }),
    );

    await expect(secondPromise).resolves.toEqual(secondResult);
    expect(firstSettled).toBe(false);

    firstWorker.emit(
      "message",
      new MessageEvent("message", { data: { id: firstRequest.id, ok: true, result: firstResult } }),
    );

    await expect(firstPromise).resolves.toEqual(firstResult);
    expect(firstRequest.id).not.toBe(secondRequest.id);
  });

  it("rejects with a typed error when called outside a browser", async () => {
    vi.unstubAllGlobals();

    await expect(compressImage(imageFile())).rejects.toBeInstanceOf(CompressionError);
    await expect(compressImage(imageFile())).rejects.toEqual(expect.objectContaining({ code: "WORKER_FAILED" }));
  });
});
