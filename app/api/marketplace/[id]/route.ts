import { NextResponse } from "next/server";
import { isUuid } from "@/lib/admin/validation";
import { getServerClient } from "@/lib/supabase/server";
import { fetchMarketplaceDetail } from "@/lib/marketplace/server-repository";

export const dynamic = "force-dynamic";

function parseCoordinate(value: string | null, min: number, max: number): number | null | false {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return false;
  return parsed;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const latitude = parseCoordinate(url.searchParams.get("lat"), -90, 90);
  const longitude = parseCoordinate(url.searchParams.get("lng"), -180, 180);
  if (latitude === false || longitude === false || (latitude === null) !== (longitude === null)) {
    return NextResponse.json({ error: "lat and lng must be valid coordinates provided together" }, { status: 400 });
  }

  const client = (await getServerClient()) as never;
  let item;
  try {
    item = await fetchMarketplaceDetail(client, id, {
      latitude,
      longitude,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!item) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  return NextResponse.json(item, {
    headers: { "cache-control": "no-store" },
  });
}
