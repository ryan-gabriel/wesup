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

interface SearchRpcRow {
  total_count?: number | string;
  [key: string]: unknown;
}

async function resolveSearchOrigin(
  client: { from: (table: string) => unknown },
  ctx: AuthContext | null,
): Promise<{ lat: number; lng: number }> {
  const table =
    ctx?.role === "supplier"
      ? "supplier_profiles"
      : ctx?.role === "umkm"
        ? "umkm_profiles"
        : null;
  if (!table || !ctx) {
    return BANDUNG_CENTER;
  }

  const query = client.from(table) as SearchOriginQuery;
  const { data } = await query
    .select("latitude,longitude")
    .eq("user_id", ctx.userId)
    .maybe();

  if (!data || data.latitude === null || data.longitude === null) {
    return BANDUNG_CENTER;
  }
  return { lat: Number(data.latitude), lng: Number(data.longitude) };
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
      ? { lat, lng }
      : await resolveSearchOrigin(client, ctx);

  const { data, error } = await client.rpc("search_batches", {
    p_query: query === "" ? null : query,
    p_categories: categories,
    p_lat: origin.lat,
    p_lng: origin.lng,
    p_radius_km: radiusKm,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const rows = (data ?? []) as SearchRpcRow[];
  const items = rows.map((row) => {
    const item = { ...row };
    delete item.total_count;
    return item;
  });
  const total = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0;

  return NextResponse.json({ items, total, page, limit });
}
