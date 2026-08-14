import {
  CompressionError,
  SUPPORTED_OUTPUT_MIME_TYPES,
  type CompressionOptions,
  type OutputMimeType,
} from "./types";

export const MAX_INPUT_BYTES = 10 * 1024 * 1024;

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxDimension: 2000,
  quality: 0.82,
  outputType: "image/jpeg",
};

const OUTPUT_MIME_TYPES = new Set<OutputMimeType>(SUPPORTED_OUTPUT_MIME_TYPES);

type ImageInput = Pick<File, "size" | "type">;

export function validateImageInput(file: ImageInput): void {
  if (file.size > MAX_INPUT_BYTES) {
    throw new CompressionError("INPUT_TOO_LARGE", "Image must not exceed 10 MiB");
  }

  if (!file.type.startsWith("image/")) {
    throw new CompressionError("UNSUPPORTED_TYPE", "Only image files are supported");
  }
}

export function normalizeCompressionOptions(options: CompressionOptions = {}): Required<CompressionOptions> {
  const normalized = {
    maxDimension: options.maxDimension === undefined ? DEFAULT_OPTIONS.maxDimension : options.maxDimension,
    quality: options.quality === undefined ? DEFAULT_OPTIONS.quality : options.quality,
    outputType: options.outputType === undefined ? DEFAULT_OPTIONS.outputType : options.outputType,
  };

  if (!Number.isFinite(normalized.quality) || normalized.quality < 0 || normalized.quality > 1) {
    throw new CompressionError("INVALID_OPTIONS", "Quality must be between 0 and 1");
  }

  if (!Number.isFinite(normalized.maxDimension) || normalized.maxDimension <= 0) {
    throw new CompressionError("INVALID_OPTIONS", "Maximum dimension must be positive");
  }

  if (!OUTPUT_MIME_TYPES.has(normalized.outputType as OutputMimeType)) {
    throw new CompressionError("INVALID_OPTIONS", "Output type must be image/jpeg, image/png, or image/webp");
  }

  return normalized;
}
