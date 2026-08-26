import { BATCH_CATEGORIES } from "@/lib/catalog/categories";
import type { MarketplaceItem } from "./types";

export const marketplaceMockItems: MarketplaceItem[] = Array.from({ length: 30 }, (_, index) => {
  const number = index + 1;
  const category = BATCH_CATEGORIES[index % BATCH_CATEGORIES.length];
  const basePrice = 25_000 + index * 2_500;
  return {
    id: `marketplace-${String(number).padStart(2, "0")}`,
    slug: `bandung-${category.toLocaleLowerCase("id-ID").replaceAll(" ", "-")}-${number}`,
    title: `${category} Bandung ${number}`,
    supplierName: `Mitra UMKM Bandung ${number}`,
    category,
    imageUrl: "/file.svg",
    distanceKm: number,
    estimatedPickupMinutes: 10 + number,
    basePrice,
    currentTierPrice: basePrice - 2_000,
    registeredQuantity: number * 3,
    targetQuantity: number * 10,
    status: "ACTIVE",
    registrationClosesAt: `2026-09-${String((number % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
  };
});
