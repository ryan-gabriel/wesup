import { CompressionError, type CompressionOptions, type CompressionResult } from "./types";
import {
  createCompressionWorkerRequest,
  parseCompressionWorkerResponse,
} from "./worker-protocol";
import { normalizeCompressionOptions, validateImageInput } from "./validation";

const DEFAULT_WORKER_TIMEOUT_MS = 30_000;

let requestSequence = 0;

function nextRequestId(): string {
  requestSequence += 1;
  return `image-compression-${Date.now()}-${requestSequence}`;
}

function workerFailure(message: string): CompressionError {
  return new CompressionError("WORKER_FAILED", message);
}

export async function compressImage(
  file: File,
  options: CompressionOptions & { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<CompressionResult> {
  const { signal, timeoutMs = DEFAULT_WORKER_TIMEOUT_MS, ...compressionOptions } = options;

  validateImageInput(file);
  const normalizedOptions = normalizeCompressionOptions(compressionOptions);

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new CompressionError("INVALID_OPTIONS", "Worker timeout must be a finite positive number");
  }

  if (signal?.aborted) {
    throw new CompressionError("ABORTED", "Image compression was aborted");
  }

  if (typeof window === "undefined" || typeof Worker === "undefined") {
    throw workerFailure("Image compression is only available in a browser");
  }

  let worker: Worker;
  try {
    worker = new Worker(new URL("./image-compression.worker.ts", import.meta.url), { type: "module" });
  } catch (error) {
    throw workerFailure(error instanceof Error && error.message ? error.message : "Unable to start image compression worker");
  }

  const id = nextRequestId();
  const request = createCompressionWorkerRequest(id, file, normalizedOptions);

  return new Promise<CompressionResult>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.removeEventListener("messageerror", handleMessageError);
      signal?.removeEventListener("abort", handleAbort);
      clearTimeout(timeout);
      try {
        worker.terminate();
      } catch {
        // Cleanup failures must not replace the compression outcome.
      }
    };

    const settle = (outcome: { result: CompressionResult } | { error: CompressionError }) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      if ("result" in outcome) {
        resolve(outcome.result);
      } else {
        reject(outcome.error);
      }
    };

    function handleMessage(event: MessageEvent<unknown>) {
      const response = parseCompressionWorkerResponse(event.data, id);
      if (response.ok) {
        settle({ result: response.result });
        return;
      }

      settle({ error: new CompressionError(response.code, response.message) });
    }

    function handleError(event: ErrorEvent) {
      const message = event.message ||
        (event.error instanceof Error && event.error.message) ||
        "Image compression worker failed";
      settle({ error: workerFailure(message) });
    }

    function handleMessageError() {
      settle({ error: workerFailure("Worker returned an unreadable response") });
    }

    function handleAbort() {
      settle({ error: new CompressionError("ABORTED", "Image compression was aborted") });
    }

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.addEventListener("messageerror", handleMessageError);
    signal?.addEventListener("abort", handleAbort, { once: true });
    const timeout = setTimeout(() => {
      settle({ error: new CompressionError("WORKER_TIMEOUT", "Image compression worker timed out") });
    }, timeoutMs);

    try {
      worker.postMessage(request);
    } catch (error) {
      settle({
        error: workerFailure(error instanceof Error && error.message ? error.message : "Unable to contact image compression worker"),
      });
    }
  });
}
