export interface ContentSecurityPolicy {
  nonce: string;
  policy: string;
}

export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export function buildContentSecurityPolicy(
  nonce: string = generateNonce(),
): ContentSecurityPolicy {
  const isDev = process.env.NODE_ENV === "development";
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://*.tile.openstreetmap.org;
    font-src 'self';
    connect-src 'self' https://*.supabase.co wss://*.supabase.co;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `;
  const policy = cspHeader.replace(/\s{2,}/g, " ").trim();
  return { nonce, policy };
}
