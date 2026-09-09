const PRODUCT_IMAGE_PREFIX = "/storage/v1/object/public/wesup-public/products/";

export function isAllowedSupplierProductImageUrl(value: string): boolean {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!configured || !value.trim()) return false;

  try {
    const projectUrl = new URL(configured);
    const imageUrl = new URL(value.trim());
    if (imageUrl.protocol !== projectUrl.protocol || imageUrl.hostname !== projectUrl.hostname || imageUrl.port !== projectUrl.port) {
      return false;
    }
    if (imageUrl.search || imageUrl.hash) return false;
    return imageUrl.pathname.startsWith(PRODUCT_IMAGE_PREFIX) && imageUrl.pathname.length > PRODUCT_IMAGE_PREFIX.length;
  } catch {
    return false;
  }
}
