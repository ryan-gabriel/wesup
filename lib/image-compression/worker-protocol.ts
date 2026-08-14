import {
  CompressionError,
  SUPPORTED_OUTPUT_MIME_TYPES,
  type CompressionErrorCode,
  type CompressionOptions,
  type CompressionResult,
  type OutputMimeType,
} from "./types";

export interface CompressionWorkerRequest {
  id: string;
  file: File;
  options: CompressionOptions;
}

export interface CompressionWorkerSuccess {
  id: string;
  ok: true;
  result: CompressionResult;
}

export interface CompressionWorkerFailure {
  id: string;
  ok: false;
  code: CompressionErrorCode;
  message: string;
}

export type CompressionWorkerResponse = CompressionWorkerSuccess | CompressionWorkerFailure;

const COMPRESSION_ERROR_CODES = new Set<CompressionErrorCode>([
  "INPUT_TOO_LARGE",
  "UNSUPPORTED_TYPE",
  "INVALID_OPTIONS",
  "DECODE_FAILED",
  "CANVAS_FAILED",
  "ENCODE_FAILED",
  "WORKER_FAILED",
  "WORKER_TIMEOUT",
  "ABORTED",
]);

const OUTPUT_TYPES = new Set<OutputMimeType>(SUPPORTED_OUTPUT_MIME_TYPES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

function isFile(value: unknown): value is File {
  if (!isBlob(value)) {
    return false;
  }

  const candidate = value as Blob & { name?: unknown; lastModified?: unknown };
  return typeof candidate.name === "string" && isNonNegativeFiniteNumber(candidate.lastModified);
}

function isCompressionOptions(value: unknown): value is CompressionOptions {
  if (!isRecord(value)) {
    return false;
  }

  const { maxDimension, quality, outputType } = value;
  return (
    (maxDimension === undefined || isPositiveFiniteNumber(maxDimension)) &&
    (quality === undefined ||
      (typeof quality === "number" && Number.isFinite(quality) && quality >= 0 && quality <= 1)) &&
    (outputType === undefined ||
      (typeof outputType === "string" &&
        OUTPUT_TYPES.has(outputType as OutputMimeType)))
  );
}

function isCompressionResult(value: unknown): value is CompressionResult {
  if (!isRecord(value) || !isBlob(value.blob)) {
    return false;
  }

  return (
    isNonNegativeFiniteNumber(value.originalSize) &&
    isNonNegativeFiniteNumber(value.compressedSize) &&
    isPositiveFiniteNumber(value.width) &&
    isPositiveFiniteNumber(value.height) &&
    typeof value.mimeType === "string"
  );
}

function isCompressionErrorCode(value: unknown): value is CompressionErrorCode {
  return typeof value === "string" && COMPRESSION_ERROR_CODES.has(value as CompressionErrorCode);
}

export function createCompressionWorkerRequest(
  id: string,
  file: File,
  options: CompressionOptions,
): CompressionWorkerRequest {
  return { id, file, options };
}

export function createCompressionWorkerSuccess(id: string, result: CompressionResult): CompressionWorkerSuccess {
  return { id, ok: true, result };
}

export function createCompressionWorkerFailure(
  id: string,
  code: CompressionErrorCode,
  message: string,
): CompressionWorkerFailure {
  return { id, ok: false, code, message };
}

export function isCompressionWorkerRequest(value: unknown): value is CompressionWorkerRequest {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isFile(value.file) &&
    isCompressionOptions(value.options)
  );
}

export function isCompressionWorkerResponse(value: unknown): value is CompressionWorkerResponse {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.ok !== "boolean") {
    return false;
  }

  if (value.ok) {
    return isCompressionResult(value.result);
  }

  return isCompressionErrorCode(value.code) && typeof value.message === "string";
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function workerErrorToFailure(id: string, error: unknown): CompressionWorkerFailure {
  return createCompressionWorkerFailure(id, "WORKER_FAILED", errorMessage(error, "Image compression worker failed"));
}

export function parseCompressionWorkerResponse(value: unknown, expectedId: string): CompressionWorkerResponse {
  if (isCompressionWorkerResponse(value) && value.id === expectedId) {
    return value;
  }

  return createCompressionWorkerFailure(expectedId, "WORKER_FAILED", "Worker returned an invalid response");
}

export function compressionErrorToFailure(id: string, error: unknown): CompressionWorkerFailure {
  if (error instanceof CompressionError) {
    return createCompressionWorkerFailure(id, error.code, error.message);
  }

  return workerErrorToFailure(id, error);
}
