import { NextResponse } from "next/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await getServerClient();
  try { await requireRole(client as unknown as AuthClient, ["supplier"]); } catch (err) { return toAuthResponse(err); }
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  const body = await parseJsonBody(req);
  if (!body || "supplierId" in body || typeof body.reason !== "string" || body.reason.trim() === "") return NextResponse.json({ error: "Cancellation reason is required" }, { status: 400 });
  const { error } = await client.rpc("cancel_batch", { p_batch_id: id, p_reason: body.reason.trim(), p_ip_address: req.headers.get("x-forwarded-for"), p_user_agent: req.headers.get("user-agent") });
  if (error) {
    const code = typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
    if (code === "42501") return NextResponse.json({ error: "Akses supplier ditolak.", code: "SUPPLIER_CATALOG_FORBIDDEN" }, { status: 403 });
    if (code === "P0002") return NextResponse.json({ error: "Katalog tidak ditemukan.", code: "SUPPLIER_CATALOG_NOT_FOUND" }, { status: 404 });
    if (code === "22023") return NextResponse.json({ error: "Permintaan pembatalan tidak valid.", code: "SUPPLIER_CATALOG_INVALID" }, { status: 400 });
    if (code === "55000") return NextResponse.json({ error: "Batch tidak dapat dibatalkan pada status saat ini.", code: "SUPPLIER_CATALOG_CONFLICT" }, { status: 409 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}