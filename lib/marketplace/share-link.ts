import type { MarketplaceItem } from "./types";

export function buildPublicMarketplaceUrl(batchId: string, siteUrl: string): string {
  const origin = new URL(siteUrl).origin;
  return new URL(`/marketplace/${encodeURIComponent(batchId)}`, origin).toString();
}

function canonicalizeUrl(value: string): string {
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function buildWhatsAppShareUrl(item: MarketplaceItem, canonicalUrl: string): string {
  const publicUrl = canonicalizeUrl(canonicalUrl);
  const message = `${item.title} — Rp${item.currentTierPrice.toLocaleString("id-ID")}\nLihat penawaran: ${publicUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
