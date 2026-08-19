import { NextResponse } from "next/server";
import { parseSupplierRegistrationFormData } from "@/lib/supplier-registration/contracts";
import { consumeSupplierRegistrationLimit } from "@/lib/supplier-registration/rate-limit";
import {
  isDuplicateSupplierEmailError,
  isSupplierEmailRateLimitError,
  registerSupplier,
  SupplierRegistrationError,
} from "@/lib/supplier-registration/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  try {
    const limit = await consumeSupplierRegistrationLimit("registration", clientIp);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan pendaftaran. Coba lagi sebentar." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const formData = await request.formData();
    const parsed = await parseSupplierRegistrationFormData(formData);
    if (!parsed.fields) {
      const tooLarge = parsed.errors.businessPhoto?.startsWith("Ukuran foto") === true;
      return NextResponse.json(
        { error: "Periksa kembali data pendaftaran.", fieldErrors: parsed.errors },
        { status: tooLarge ? 413 : 400 },
      );
    }

    const result = await registerSupplier(parsed.fields);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (isSupplierEmailRateLimitError(error)) {
      return NextResponse.json(
        { error: "Kuota email konfirmasi sedang penuh. Coba lagi nanti." },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }
    if (isDuplicateSupplierEmailError(error)) {
      return NextResponse.json(
        { error: "Email sudah digunakan.", fieldErrors: { email: "Email sudah digunakan." } },
        { status: 409 },
      );
    }
    if (error instanceof SupplierRegistrationError) {
      return NextResponse.json({ error: "Pendaftaran belum dapat diproses. Coba lagi." }, { status: 500 });
    }
    return NextResponse.json({ error: "Pendaftaran belum dapat diproses. Coba lagi." }, { status: 500 });
  }
}
