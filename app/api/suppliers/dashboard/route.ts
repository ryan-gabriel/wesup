import { NextResponse } from "next/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { mapSupplierBatchRow, type SupplierBatchRpcRow } from "@/lib/supplier-catalog/api";

export const dynamic = "force-dynamic";

interface DashboardRow {
  supplier_name?: unknown; supplier_status?: unknown; active_batch_count?: unknown;
  total_participant_count?: unknown; collected_revenue?: unknown; ready_to_disburse?: unknown;
  average_rating?: unknown; rating_count?: unknown;
}

function number(value: unknown, fallback = 0) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function text(value: unknown, fallback = "") { return typeof value === "string" && value.trim() ? value : fallback; }
function errorResponse(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (code === "42501") return NextResponse.json({ error: "Akses supplier ditolak.", code: "SUPPLIER_CATALOG_FORBIDDEN" }, { status: 403 });
  console.error("[suppliers/dashboard] request failed", error);
  return NextResponse.json({ error: "Dashboard belum dapat dimuat.", code: "SUPPLIER_CATALOG_REQUEST_FAILED" }, { status: 500 });
}

export async function GET() {
  const client = await getServerClient();
  try { await requireRole(client as unknown as AuthClient, ["supplier"]); } catch (error) { return toAuthResponse(error); }
  const [summaryResult, batchesResult] = await Promise.all([
    client.rpc("get_supplier_dashboard_summary"),
    client.rpc("list_supplier_batches", { p_status: null, p_query: null }),
  ]);
  if (summaryResult.error) return errorResponse(summaryResult.error);
  if (batchesResult.error) return errorResponse(batchesResult.error);
  const row = (Array.isArray(summaryResult.data) ? summaryResult.data[0] : null) as DashboardRow | null;
  if (!row) return NextResponse.json({ error: "Dashboard belum tersedia.", code: "SUPPLIER_CATALOG_REQUEST_FAILED" }, { status: 500 });
  const batches = (Array.isArray(batchesResult.data) ? batchesResult.data : []).slice(0, 3);
  return NextResponse.json({
    supplier: { displayName: text(row.supplier_name, "Supplier Wesup"), verificationStatus: text(row.supplier_status) },
    summary: {
      activeBatchCount: number(row.active_batch_count), participantCount: number(row.total_participant_count),
      collectedRevenue: number(row.collected_revenue), readyToDisburse: number(row.ready_to_disburse),
      ratingAverage: number(row.rating_count) === 0 ? null : number(row.average_rating), ratingTotal: number(row.rating_count),
    },
    recentBatches: batches.map((batch) => mapSupplierBatchRow(batch as SupplierBatchRpcRow)),
  });
}
