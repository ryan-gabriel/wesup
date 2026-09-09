import { mapMarketplaceRpcRow, type MarketplaceRpcRow } from "./api-mapper";
import type { MarketplaceItem } from "./types";

export interface MarketplaceDetailRpcClient {
  rpc: (
    functionName: string,
    params: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown[] | null; error: Error | null }>;
}

export async function fetchMarketplaceDetail(
  client: MarketplaceDetailRpcClient,
  batchId: string,
  coordinates: { latitude: number | null; longitude: number | null } = {
    latitude: null,
    longitude: null,
  },
): Promise<MarketplaceItem | null> {
  const { data, error } = await client.rpc("get_marketplace_batch", {
    p_batch_id: batchId,
    p_lat: coordinates.latitude,
    p_lng: coordinates.longitude,
  });
  if (error) throw error;
  const row = (data?.[0] ?? null) as MarketplaceRpcRow | null;
  return row ? mapMarketplaceRpcRow(row) : null;
}
