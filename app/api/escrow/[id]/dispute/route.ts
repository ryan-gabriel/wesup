import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { isUuid } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/escrow/[id]/dispute — UMKM creates a dispute for an escrow hold.
 *
 * Freezes the escrow (prevents auto-release) and creates a dispute record.
 *
 * Body: { description, photo_urls?: string[] }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: escrowId } = await params;
  if (!isUuid(escrowId)) {
    return NextResponse.json({ error: "Invalid escrow id" }, { status: 400 });
  }

  const client = await getServerClient();

  let context;
  try {
    context = await requireRole(client as unknown as AuthClient, ["umkm"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  if (!description) {
    return NextResponse.json(
      { error: "Description is required" },
      { status: 400 },
    );
  }

  const photoUrls = Array.isArray(body.photo_urls)
    ? (body.photo_urls as string[]).filter((u) => typeof u === "string")
    : [];

  // Fetch escrow and verify ownership
  const { data: escrow, error: escrowError } = await client
    .from("escrow_holds")
    .select(
      "id, registration_id, status, registrations!inner(umkm_id, batches!inner(supplier_id))",
    )
    .eq("id", escrowId)
    .single();

  if (escrowError || !escrow) {
    return NextResponse.json({ error: "Escrow not found" }, { status: 404 });
  }

  const regData = Array.isArray(escrow.registrations)
    ? escrow.registrations[0]
    : escrow.registrations;

  if (regData?.umkm_id !== context.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (escrow.status !== "held") {
    return NextResponse.json(
      { error: `Escrow is '${escrow.status}', can only dispute 'held' escrow` },
      { status: 400 },
    );
  }

  const batchData = regData
    ? Array.isArray(regData.batches)
      ? regData.batches[0]
      : regData.batches
    : null;
  const supplierId = batchData?.supplier_id ?? "";

  // Check for existing dispute
  const { data: existingDispute } = await client
    .from("disputes")
    .select("id")
    .eq("registration_id", escrow.registration_id)
    .single();

  if (existingDispute) {
    return NextResponse.json(
      { error: "A dispute already exists for this registration" },
      { status: 409 },
    );
  }

  // Create dispute
  const { data: dispute, error: disputeError } = await client
    .from("disputes")
    .insert({
      registration_id: escrow.registration_id,
      umkm_id: context.userId,
      supplier_id: supplierId,
      description,
      photo_urls: photoUrls,
      status: "pending",
    })
    .select("id, created_at")
    .single();

  if (disputeError || !dispute) {
    return NextResponse.json(
      { error: "Failed to create dispute" },
      { status: 500 },
    );
  }

  // Link dispute to escrow (freezes auto-release)
  await client
    .from("escrow_holds")
    .update({ dispute_id: dispute.id })
    .eq("id", escrowId);

  return NextResponse.json(
    {
      success: true,
      data: {
        dispute_id: dispute.id,
        escrow_id: escrowId,
      },
      message:
        "Dispute berhasil dibuat. Admin akan mereview dalam 1x24 jam.",
    },
    { status: 201 },
  );
}
