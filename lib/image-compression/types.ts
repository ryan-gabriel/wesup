export const SUPPORTED_OUTPUT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type OutputMimeType = (typeof SUPPORTED_OUTPUT_MIME_TYPES)[number];

export interface CompressionOptions {
  maxDimension?: number;
  quality?: number;
  outputType?: OutputMimeType;
}

export interface CompressionResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  mimeType: string;
}

export type CompressionErrorCode =
  | "INPUT_TOO_LARGE"
  | "UNSUPPORTED_TYPE"
  | "INVALID_OPTIONS"
  | "DECODE_FAILED"
  | "CANVAS_FAILED"
  | "ENCODE_FAILED"
  | "WORKER_FAILED"
  | "WORKER_TIMEOUT"
  | "ABORTED";

export class CompressionError extends Error {
  constructor(
    public readonly code: CompressionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CompressionError";
  }
}
