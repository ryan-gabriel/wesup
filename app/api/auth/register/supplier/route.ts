import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { validateSupplierLocation } from "@/lib/maps/bandung";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NIK_RE = /^\d{16}$/;

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 1. Essential Auth Data
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password minimal 8 karakter." },
      { status: 400 },
    );
  }
  if (!fullName) {
    return NextResponse.json({ error: "Nama lengkap wajib diisi." }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "Nomor WhatsApp / telepon wajib diisi." }, { status: 400 });
  }

  // 2. Essential Supplier Business Data
  const businessName = typeof body.business_name === "string" ? body.business_name.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const nik = typeof body.nik === "string" ? body.nik.trim() : "";
  const ktpPhotoUrl = typeof body.ktp_photo_url === "string" ? body.ktp_photo_url.trim() : "";
  const businessPhotoUrl = typeof body.business_photo_url === "string" && body.business_photo_url.trim()
    ? body.business_photo_url.trim()
    : null;

  if (!businessName) {
    return NextResponse.json({ error: "Nama usaha (business_name) wajib diisi." }, { status: 400 });
  }
  if (!address) {
    return NextResponse.json({ error: "Alamat lengkap tempat usaha wajib diisi." }, { status: 400 });
  }
  if (!NIK_RE.test(nik)) {
    return NextResponse.json(
      { error: "NIK tidak valid. NIK wajib terdiri dari 16 digit angka." },
      { status: 400 },
    );
  }
  if (!ktpPhotoUrl) {
    return NextResponse.json({ error: "Foto KTP (ktp_photo_url) wajib diunggah." }, { status: 400 });
  }

  // 3. Location Validation (Pin Map & Bandung Boundary Check)
  const locValidation = validateSupplierLocation(body.latitude, body.longitude);
  if (!locValidation.valid) {
    return NextResponse.json({ error: locValidation.error }, { status: 400 });
  }
  const latitude = typeof body.latitude === "number" ? body.latitude : Number(body.latitude);
  const longitude = typeof body.longitude === "number" ? body.longitude : Number(body.longitude);

  // 4. Location Consent Verification (Perekaman Persetujuan)
  if (body.location_consent !== true) {
    return NextResponse.json(
      { error: "Persetujuan (consent) lokasi wajib dicentang untuk mendaftar sebagai Supplier." },
      { status: 400 },
    );
  }
  const consentedAt = new Date().toISOString();

  // 5. Create Supabase Auth User & Supplier Profile
  const client = await getServerClient();

  const { data: authData, error: authError } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: "supplier",
        location_consent: true,
        location_consented_at: consentedAt,
        consent_latitude: latitude,
        consent_longitude: longitude,
      },
    },
    ...(phone ? { phone } : {}),
  });

  if (authError) {
    if (authError.code === "user_already_exists" || (authError.message && /already registered|already exists/i.test(authError.message))) {
      return NextResponse.json(
        { code: authError.code ?? "user_already_exists", error: "Email sudah terdaftar dalam sistem." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: authError.message || "Internal server error" }, { status: 500 });
  }

  if (!authData.user) {
    return NextResponse.json({ error: "Gagal membuat akun Supplier." }, { status: 500 });
  }

  // 6. Insert Supplier Profile with KYC & Location
  const { error: profileError } = await client.from("supplier_profiles").insert({
    user_id: authData.user.id,
    business_name: businessName,
    address,
    latitude,
    longitude,
    ktp_photo_url: ktpPhotoUrl,
    business_photo_url: businessPhotoUrl,
    nik,
    verification_status: "pending",
    is_location_locked: false,
  });

  if (profileError) {
    if (profileError.code === "23505" || (profileError.message && /nik/i.test(profileError.message))) {
      return NextResponse.json(
        { code: "duplicate_nik", error: "NIK sudah terdaftar dalam sistem." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Gagal menyimpan data profil Supplier." }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email ?? email,
        full_name: fullName,
        phone,
      },
      supplier_profile: {
        business_name: businessName,
        address,
        latitude,
        longitude,
        verification_status: "pending",
      },
      consent: {
        location_consent: true,
        consented_at: consentedAt,
      },
      message: "Pendaftaran Supplier berhasil. Akun Anda menunggu verifikasi oleh Admin.",
    },
    { status: 201 },
  );
}
