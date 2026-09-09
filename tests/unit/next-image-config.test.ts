import { describe, expect, it } from "vitest";
import { matchRemotePattern } from "next/dist/shared/lib/match-remote-pattern";
import nextConfig from "../../next.config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");

function remotePatterns() {
  const images = nextConfig.images;
  return images ? images.remotePatterns ?? [] : [];
}

describe("Next Image Supabase product configuration", () => {
  it("allows product objects from the active Supabase project", () => {
    expect(supabaseUrl).toBeTruthy();
    const source = new URL(
      `${supabaseUrl}/storage/v1/object/public/wesup-public/products/984c63e0-3e3b-4bfc-bd2c-122f9bf59215/aab8cfc5-7f33-4368-9828-210cb41d9ab1.webp`,
    );
    expect(remotePatterns().some((pattern) => matchRemotePattern(pattern, source))).toBe(true);
  });

  it("rejects another host, bucket, folder, and query string", () => {
    expect(supabaseUrl).toBeTruthy();
    const base = `${supabaseUrl}/storage/v1/object/public`;
    const disallowed = [
      new URL(`${base.replace(new URL(supabaseUrl!).hostname, "other-project.supabase.co")}/wesup-public/products/batch/photo.webp`),
      new URL(`${base}/wesup-assets/products/batch/photo.webp`),
      new URL(`${base}/wesup-public/business/batch/photo.webp`),
      new URL(`${base}/wesup-public/products/batch/photo.webp?download=1`),
    ];
    for (const source of disallowed) {
      expect(remotePatterns().some((pattern) => matchRemotePattern(pattern, source))).toBe(false);
    }
  });
});
