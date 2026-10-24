import { NextResponse } from "next/server";
import { isUuid } from "@/lib/admin/validation";
import { getAdminClient } from "@/lib/supabase/admin";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { toUmkmOrderDetail, type OrderReadRow } from "@/lib/orders/read-model";
import { DETAIL_SELECT, readCompatibleOrder } from "@/lib/orders/selects";
import { paymentDemoFor } from "@/lib/payments/demo";

export const dynamic = "force-dynamic";

interface DetailQuery {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{ data: OrderReadRow | null; error: unknown | null }>;
      };
      maybeSingle: () => PromiseLike<{ data: OrderReadRow | null; error: unknown | null }>;
    };
  };
}

interface RpcCapableClient { rpc?: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data?: unknown; error?: unknown | null }> }

function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) return String((error as Record<string, unknown>).code ?? "UNKNOWN");
  return "UNKNOWN";
}
function errorResponse(error: string, code: string, status: number, requestId = crypto.randomUUID()) {
  return NextResponse.json({ error, code, requestId }, { status, headers: status >= 500 ? { "Retry-After": "5" } : undefined });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const viewer = await resolveActiveUmkm({allowSuspended:true});
  if (!viewer.client) return viewer.response;
  const { orderId } = await params;
  if (!isUuid(orderId)) return errorResponse("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);

  const query = viewer.client.from("registrations") as DetailQuery;
  const initial = await readCompatibleOrder((projection) => query.select(projection).eq("id", orderId).eq("umkm_id", viewer.context.userId).maybeSingle(), DETAIL_SELECT);
  let result: { data: OrderReadRow | null; error: unknown | null } = initial;
  if (result.error) {
    const raw = result.error as { code?: unknown };
    const code = String(raw.code ?? "");
    const requestId = crypto.randomUUID();
    console.error("[umkm-orders] detail read failed", { operation: "detail", code: errorCode(result.error), requestId });
    const schemaFailure = ["PGRST200", "PGRST201", "PGRST202", "42883", "42P01"].includes(code);
    return errorResponse(schemaFailure ? "Data pembayaran pesanan sedang disiapkan. Coba lagi beberapa saat." : "Detail pesanan belum dapat dimuat. Coba lagi.", schemaFailure ? "ORDER_DETAIL_SCHEMA_NOT_READY" : "ORDER_READ_FAILED", schemaFailure ? 503 : 500, requestId);
  }
  if (!result.data) return errorResponse("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);

  const rpcClient = viewer.client as RpcCapableClient;
  if (typeof rpcClient.rpc === "function") {
    const lifecycleRpc = "materialize_supplier_order";
    await Promise.resolve(rpcClient.rpc(lifecycleRpc, { p_registration_id: orderId })).catch(() => undefined);
    const refreshed = await (viewer.client.from("registrations") as DetailQuery).select(initial.projection).eq("id", orderId).eq("umkm_id", viewer.context.userId).maybeSingle();
    if (!refreshed.error && refreshed.data) result = refreshed;
  }

  const serverTime = new Date().toISOString();
  const row = result.data;
  if (!row) return errorResponse("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);
  const detail = toUmkmOrderDetail(row, serverTime, viewer.context.status === "active");
  detail.paymentDemo = paymentDemoFor(detail, viewer.context.userId, viewer.context.status === "active");
  if (detail.paymentDemo.canSimulatePaid && detail.paymentAttempt?.checkoutMode === "snap") {
    try {
      const session = await getAdminClient().from("payment_checkout_sessions")
        .select("id,expires_at,cancelled_at").eq("payment_attempt_id", detail.paymentAttempt.id).maybeSingle();
      if (session.error || !session.data || session.data.cancelled_at || !(Date.parse(session.data.expires_at) > Date.parse(serverTime))) {
        detail.paymentDemo = { ...detail.paymentDemo, canSimulatePaid: false, checkoutReference: null, blockedReason: "Sesi checkout belum tersimpan atau telah kedaluwarsa." };
      }
    } catch {
      detail.paymentDemo = { ...detail.paymentDemo, canSimulatePaid: false, checkoutReference: null, blockedReason: "Sesi checkout belum dapat diverifikasi. Muat ulang detail." };
    }
  }
  if (typeof rpcClient.rpc === "function" && detail.status === "registered") {
    try {
      const early = await rpcClient.rpc("get_early_payment_context", { p_batch_id: row.batch_id });
      if (early.error) detail.earlyPaymentError = "Usulan pembayaran belum dapat dimuat. Muat ulang detail.";
      else if (early.data && typeof early.data === "object") detail.earlyPayment = early.data as import("@/lib/transactions/early-payment").EarlyPaymentContext;
    } catch { detail.earlyPaymentError = "Usulan pembayaran belum dapat dimuat. Muat ulang detail."; }
  }
  if (detail.dispute?.photoUrls.length) {
    try {
      const storage = getAdminClient().storage.from("wesup-assets");
      const signed = await storage.createSignedUrls(detail.dispute.photoUrls, 60 * 60);
      if (!signed.error && signed.data) {
        detail.dispute.photoUrls = signed.data.map((entry, index) => entry.signedUrl ?? detail.dispute?.photoUrls[index] ?? "");
      }
    } catch {
      // A storage outage must not hide the rest of the order snapshot.
    }
  }
  return NextResponse.json(detail);
}
