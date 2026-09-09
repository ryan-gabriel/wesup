import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import {
  getCurrentUser,
  type AuthClient,
  type AuthContext,
} from "@/lib/supabase/auth";
import {
  BANDUNG_CENTER,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_DEFAULT_RADIUS_KM,
  SEARCH_MAX_LIMIT,
  SEARCH_MAX_QUERY_LENGTH,
  SEARCH_MAX_RADIUS_KM,
  SEARCH_MIN_RADIUS_KM,
  isBatchCategory,
} from "@/lib/catalog/categories";
import { parsePositiveInt } from "@/lib/admin/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { mapMarketplaceRpcRows, type MarketplaceRpcRow } from "@/lib/marketplace/api-mapper";

export const dynamic = "force-dynamic";

interface CoordsResponse {
  data: { latitude: number | string | null; longitude: number | string | null } | null;
  error: Error | null;
}

interface SearchOriginQuery {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybe: () => PromiseLike<CoordsResponse>;
    };
  };
}

interface SearchOrigin {
  latitude: number;
  longitude: number;
  source: "umkm_profile" | "request" | "bandung_default";
}

interface MarketplaceRpcError {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
}

function isMarketplaceRpcError(error: unknown): error is MarketplaceRpcError {
  return typeof error === "object" && error !== null;
}

function isMarketplaceSchemaOutdated(error: unknown): boolean {
  if (!isMarketplaceRpcError(error)) return false;
  return error.code === "PGRST202" && /search_batches/i.test(String(error.message ?? ""));
}

async function resolveSearchOrigin(
  client: { from: (table: string) => unknown },
  ctx: AuthContext | null,
): Promise<SearchOrigin> {
  if (ctx?.role !== "umkm") {
    return {
      latitude: BANDUNG_CENTER.lat,
      longitude: BANDUNG_CENTER.lng,
      source: "bandung_default",
    };
  }

  const query = client.from("umkm_profiles") as SearchOriginQuery;
  const { data } = await query
    .select("latitude,longitude")
    .eq("user_id", ctx.userId)
    .maybe();

  const latitude = Number(data?.latitude);
  const longitude = Number(data?.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return {
      latitude: BANDUNG_CENTER.lat,
      longitude: BANDUNG_CENTER.lng,
      source: "bandung_default",
    };
  }
  return { latitude, longitude, source: "umkm_profile" };
}

export async function GET(req: Request) {
  const client = await getServerClient();
  const ctx = await getCurrentUser(client as unknown as AuthClient);

  const limited = await enforceRateLimit(req, "search", ctx?.userId);
  if (limited) return limited;

  const url = new URL(req.url);

  const query = (url.searchParams.get("q") ?? "").trim();
  if (query.length > SEARCH_MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `q must be at most ${SEARCH_MAX_QUERY_LENGTH} characters` },
      { status: 400 },
    );
  }

  let categories: string[] | null = null;
  const categoriesParam = url.searchParams.get("categories");
  if (categoriesParam !== null && categoriesParam.trim() !== "") {
    categories = [];
    for (const raw of categoriesParam.split(",")) {
      const value = raw.trim();
      if (value === "") continue;
      if (!isBatchCategory(value)) {
        return NextResponse.json(
          { error: `unknown category: ${value}` },
          { status: 400 },
        );
      }
      if (!categories.includes(value)) {
        categories.push(value);
      }
    }
    if (categories.length === 0) {
      categories = null;
    }
  }

  let lat: number | null = null;
  let lng: number | null = null;
  const latParam = url.searchParams.get("lat");
  const lngParam = url.searchParams.get("lng");
  if ((latParam === null) !== (lngParam === null)) {
    return NextResponse.json(
      { error: "lat and lng must be provided together" },
      { status: 400 },
    );
  }
  if (latParam !== null && lngParam !== null) {
    lat = Number(latParam);
    lng = Number(lngParam);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return NextResponse.json(
        { error: "lat and lng must be numbers" },
        { status: 400 },
      );
    }
    if (lat < -90 || lat > 90) {
      return NextResponse.json(
        { error: "lat must be between -90 and 90" },
        { status: 400 },
      );
    }
    if (lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: "lng must be between -180 and 180" },
        { status: 400 },
      );
    }
  }

  let radiusKm = SEARCH_DEFAULT_RADIUS_KM;
  const radiusParam = url.searchParams.get("radius");
  if (radiusParam !== null && radiusParam.trim() !== "") {
    const parsed = Number(radiusParam);
    if (!Number.isFinite(parsed)) {
      return NextResponse.json(
        { error: "radius must be a number" },
        { status: 400 },
      );
    }
    radiusKm = Math.min(
      SEARCH_MAX_RADIUS_KM,
      Math.max(SEARCH_MIN_RADIUS_KM, parsed),
    );
  }

  let minPrice: number | null = null;
  const minPriceParam = url.searchParams.get("minPrice");
  if (minPriceParam !== null && minPriceParam.trim() !== "") {
    const parsed = Number(minPriceParam);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return NextResponse.json({ error: "minPrice must be a non-negative number" }, { status: 400 });
    }
    minPrice = parsed;
  }

  let maxPrice: number | null = null;
  const maxPriceParam = url.searchParams.get("maxPrice");
  if (maxPriceParam !== null && maxPriceParam.trim() !== "") {
    const parsed = Number(maxPriceParam);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return NextResponse.json({ error: "maxPrice must be a non-negative number" }, { status: 400 });
    }
    maxPrice = parsed;
  }
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    return NextResponse.json({ error: "minPrice cannot exceed maxPrice" }, { status: 400 });
  }

  const limitParam = url.searchParams.get("limit");
  const limit =
    limitParam === null ? SEARCH_DEFAULT_LIMIT : parsePositiveInt(limitParam);
  if (limit === null || limit < 1 || limit > SEARCH_MAX_LIMIT) {
    return NextResponse.json(
      { error: `limit must be an integer between 1 and ${SEARCH_MAX_LIMIT}` },
      { status: 400 },
    );
  }

  const pageParam = url.searchParams.get("page");
  const page = pageParam === null ? 1 : parsePositiveInt(pageParam);
  if (page === null || page < 1) {
    return NextResponse.json(
      { error: "page must be a positive integer" },
      { status: 400 },
    );
  }
  const offset = (page - 1) * limit;

  const origin =
    lat !== null && lng !== null
      ? { latitude: lat, longitude: lng, source: "request" as const }
      : await resolveSearchOrigin(client, ctx);

  const { data, error } = await client.rpc("search_batches", {
    p_query: query === "" ? null : query,
    p_categories: categories,
    p_lat: origin.latitude,
    p_lng: origin.longitude,
    p_radius_km: radiusKm,
    p_min_price: minPrice,
    p_max_price: maxPrice,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) {
    const rpcError: MarketplaceRpcError = isMarketplaceRpcError(error) ? error : {};
    console.error("[marketplace/search] search_batches failed", {
      code: rpcError.code,
      message: rpcError.message,
      details: rpcError.details,
      hint: rpcError.hint,
    });
    if (isMarketplaceSchemaOutdated(error)) {
      return NextResponse.json(
        {
          error: "Marketplace sedang disiapkan. Coba lagi sebentar.",
          code: "MARKETPLACE_SCHEMA_OUTDATED",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Penawaran belum dapat dimuat. Coba lagi.", code: "MARKETPLACE_QUERY_FAILED" },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as MarketplaceRpcRow[];
  const items = mapMarketplaceRpcRows(rows);
  const total = rows.length > 0 ? Math.max(0, Number(rows[0].total_count ?? 0)) : 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize: limit,
    totalPages,
    origin,
  });
}
