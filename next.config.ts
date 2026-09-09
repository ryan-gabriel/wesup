import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
];

function getSupabaseProductImagePattern(): URL {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!rawUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL: required to configure Supabase product images in next/image.",
    );
  }

  let supabaseUrl: URL;
  try {
    supabaseUrl = new URL(rawUrl);
  } catch {
    throw new Error(
      "Invalid NEXT_PUBLIC_SUPABASE_URL: expected an absolute http(s) URL for Supabase product images.",
    );
  }

  if (supabaseUrl.protocol !== "http:" && supabaseUrl.protocol !== "https:") {
    throw new Error(
      "Invalid NEXT_PUBLIC_SUPABASE_URL: expected an absolute http(s) URL for Supabase product images.",
    );
  }

  return new URL(
    "/storage/v1/object/public/wesup-public/products/**",
    supabaseUrl,
  );
}
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [getSupabaseProductImagePattern()],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
