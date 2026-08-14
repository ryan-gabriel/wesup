import { normalizeCompressionOptions, validateImageInput } from "./validation";
import {
  compressionErrorToFailure,
  createCompressionWorkerFailure,
  createCompressionWorkerSuccess,
  isCompressionWorkerRequest,
  type CompressionWorkerRequest,
  type CompressionWorkerResponse,
} from "./worker-protocol";

interface BitmapResource {
  width: number;
  height: number;
  close(): void;
}

interface Canvas2DContext {
  drawImage(image: BitmapResource, dx: number, dy: number, width: number, height: number): void;
}

interface CompressionCanvas {
  getContext(contextId: "2d"): Canvas2DContext | null;
  convertToBlob(options: { type: string; quality: number }): Promise<Blob>;
}

export interface CompressionWorkerRuntime {
  createImageBitmap(file: File): Promise<BitmapResource>;
  createCanvas(width: number, height: number): CompressionCanvas;
}

type PostCompressionWorkerResponse = (message: CompressionWorkerResponse) => void;

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

const browserRuntime: CompressionWorkerRuntime = {
  createImageBitmap(file) {
    if (typeof globalThis.createImageBitmap !== "function") {
      return Promise.reject(new Error("Image bitmap decoding is unavailable"));
    }

    return globalThis.createImageBitmap(file);
  },
  createCanvas(width, height) {
    if (typeof OffscreenCanvas === "undefined") {
      throw new Error("Offscreen canvas is unavailable");
    }

    return new OffscreenCanvas(width, height) as CompressionCanvas;
  },
};

function targetDimensions(width: number, height: number, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function processCompressionWorkerRequest(
  request: CompressionWorkerRequest,
  runtime: CompressionWorkerRuntime = browserRuntime,
): Promise<CompressionWorkerResponse> {
  let options: ReturnType<typeof normalizeCompressionOptions>;

  try {
    validateImageInput(request.file);
    options = normalizeCompressionOptions(request.options);
  } catch (error) {
    return compressionErrorToFailure(request.id, error);
  }

  let bitmap: BitmapResource;
  try {
    bitmap = await runtime.createImageBitmap(request.file);
  } catch (error) {
    return createCompressionWorkerFailure(request.id, "DECODE_FAILED", messageFrom(error, "Image decoding failed"));
  }

  try {
    if (!Number.isFinite(bitmap.width) || !Number.isFinite(bitmap.height) || bitmap.width <= 0 || bitmap.height <= 0) {
      return createCompressionWorkerFailure(request.id, "DECODE_FAILED", "Decoded image has invalid dimensions");
    }

    const dimensions = targetDimensions(bitmap.width, bitmap.height, options.maxDimension);
    let canvas: CompressionCanvas;
    let context: Canvas2DContext | null;

    try {
      canvas = runtime.createCanvas(dimensions.width, dimensions.height);
      context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Unable to create a 2D canvas context");
      }
      context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);
    } catch (error) {
      return createCompressionWorkerFailure(request.id, "CANVAS_FAILED", messageFrom(error, "Canvas rendering failed"));
    }

    let blob: Blob;
    try {
      blob = await canvas.convertToBlob({ type: options.outputType, quality: options.quality });
    } catch (error) {
      return createCompressionWorkerFailure(request.id, "ENCODE_FAILED", messageFrom(error, "Image encoding failed"));
    }

    if (blob.type !== options.outputType) {
      return createCompressionWorkerFailure(
        request.id,
        "ENCODE_FAILED",
        `Browser returned ${blob.type || "an unknown MIME type"} instead of requested ${options.outputType}`,
      );
    }

    return createCompressionWorkerSuccess(request.id, {
      blob,
      originalSize: request.file.size,
      compressedSize: blob.size,
      width: dimensions.width,
      height: dimensions.height,
      mimeType: options.outputType,
    });
  } finally {
    try {
      bitmap.close();
    } catch {
      // Resource cleanup must not replace the compression result.
    }
  }
}

function requestIdFrom(value: unknown): string {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"
    ? value.id
    : "unknown";
}

export async function handleCompressionWorkerMessage(
  data: unknown,
  postMessage: PostCompressionWorkerResponse,
  runtime: CompressionWorkerRuntime = browserRuntime,
): Promise<void> {
  const id = requestIdFrom(data);
  if (!isCompressionWorkerRequest(data)) {
    postMessage(createCompressionWorkerFailure(id, "WORKER_FAILED", "Worker received an invalid request"));
    return;
  }

  try {
    postMessage(await processCompressionWorkerRequest(data, runtime));
  } catch (error) {
    postMessage(
      createCompressionWorkerFailure(id, "WORKER_FAILED", messageFrom(error, "Image compression worker failed")),
    );
  }
}

interface WorkerMessageEvent {
  data: unknown;
}

interface DedicatedWorkerScope {
  document?: unknown;
  importScripts?: (...urls: string[]) => void;
  addEventListener(type: "message", listener: (event: WorkerMessageEvent) => void): void;
  postMessage(message: CompressionWorkerResponse): void;
}

const workerScope = globalThis as unknown as DedicatedWorkerScope;

if (
  workerScope.document === undefined &&
  typeof workerScope.importScripts === "function" &&
  typeof workerScope.addEventListener === "function" &&
  typeof workerScope.postMessage === "function"
) {
  workerScope.addEventListener("message", (event) => {
    void handleCompressionWorkerMessage(event.data, (message) => workerScope.postMessage(message));
  });
}
