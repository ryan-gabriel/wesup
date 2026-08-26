# Role-Based Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengubah placeholder `/login` menjadi formulir login Supabase yang fungsional, memiliki pilihan Admin/UMKM/Supplier, mengikuti tema biru halaman pendaftaran pemasok, dan menolak role atau status akun yang tidak sesuai secara aman di server.

**Architecture:** `app/login/page.tsx` tetap menjadi Server Component untuk metadata dan kerangka halaman, sedangkan state formulir ditempatkan pada Client Component terpisah. Form mengirim JSON ke Route Handler login yang sudah ada; Route Handler melakukan autentikasi password melalui Supabase, mengambil role/status resmi dari database, membatalkan sesi bila role atau status tidak cocok, lalu mengembalikan kontrak respons yang konsisten. Pilihan role hanya berfungsi sebagai konteks login yang harus cocok dengan database, bukan sebagai sumber otorisasi.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript strict, Tailwind CSS 4, Supabase SSR/Auth, Lucide React, Vitest 4.

**Spec:** `prd/PRD.md` bagian 2.4.1 (Autentikasi & Manajemen Sesi), `docs/superpowers/specs/2026-08-05-auth-rls-hardening-design.md`, dan pola visual `app/supplier/register/page.tsx`.

## Global Constraints

- Tidak membuat migration database baru: `profiles.role`, `profiles.status`, dan `supplier_profiles.verification_status` sudah tersedia dan dilindungi RLS.
- Role resmi selalu dibaca dari `public.profiles`; nilai `role` dari browser tidak pernah ditulis ke database atau metadata Auth.
- Akun baru tetap ber-role `umkm`; role `supplier` hanya diberikan trigger database setelah verifikasi pemasok berstatus `approved`.
- Akun `suspended_temporary`, `suspended_permanent`, atau `banned` tidak boleh mempertahankan sesi login.
- Jika autentikasi berhasil tetapi pemeriksaan profil, status, atau role gagal, Route Handler wajib memanggil `signOut()` sebelum mengembalikan error.
- Pesan kredensial salah harus generik (`Email atau password salah.`) agar tidak membocorkan keberadaan akun.
- Password tidak boleh masuk URL, log, toast, local storage, atau respons API.
- UI mengikuti halaman register: latar gradien biru muda, kartu putih, border slate, CTA `blue-600`, focus ring biru, dan pesan error merah.
- Karena dashboard per-role belum tersedia di repository, semua login sukses untuk tahap ini diarahkan ke `/`. Kontrak menyediakan `redirectTo` sehingga pemetaan tujuan dapat diganti tanpa mengubah komponen form ketika dashboard tersedia.
- `proxy.ts`, `lib/supabase/server.ts`, dan `app/api/auth/session/route.ts` dipakai sebagaimana adanya; Proxy hanya menyegarkan cookie dan tidak menggantikan pemeriksaan otorisasi server.
- Tidak menambahkan tautan “Lupa password” sampai halaman UI pemulihan password tersedia; API saja bukan tujuan navigasi pengguna.
- Ikuti TDD repository: tes ditulis lebih dahulu dan bukti RED/GREEN/verification dicatat di `docs/testing/role-login.tdd.md`.

---

## File Map

| File | Aksi | Tanggung jawab |
|---|---|---|
| `lib/auth/login-contract.ts` | Create | Tipe request/response, daftar role UI, normalisasi/validasi payload, copy error status/role, dan tujuan redirect. |
| `tests/unit/login-contract.test.ts` | Create | Menguji kontrak login sebagai fungsi murni tanpa browser atau jaringan. |
| `app/api/auth/login/route.ts` | Modify | Login password, baca profil resmi, validasi status dan selected role, supplier verification feedback, serta cleanup sesi gagal. |
| `tests/unit/api-auth.test.ts` | Modify | Menguji Route Handler login untuk sukses dan seluruh cabang kegagalan yang penting. |
| `components/auth/LoginForm.tsx` | Create | Role selector, field email/password, tombol mata, loading, feedback error, submit, toast sukses, dan redirect. |
| `app/login/page.tsx` | Modify | Metadata dan shell visual yang mengikuti halaman register. |
| `docs/testing/role-login.tdd.md` | Create | Bukti perintah RED/GREEN, lint, build, dan QA manual. |

Tidak ada perubahan pada migration Supabase, `proxy.ts`, service-role client, atau RLS.

---

### Task 1: Definisikan kontrak login yang dipakai client dan server

**Files:**
- Create: `tests/unit/login-contract.test.ts`
- Create: `lib/auth/login-contract.ts`

**Interfaces:**
- Consumes: `UserRole` dan `AccountStatus` dari `types/database.ts`.
- Produces: `LOGIN_ROLES`, `LoginRole`, `LoginRequest`, `LoginSuccessResponse`, `LoginErrorResponse`, `parseLoginPayload()`, `getAccountStatusMessage()`, `getRoleMismatchMessage()`, dan `LOGIN_REDIRECT_BY_ROLE`.

- [ ] **Step 1: Tulis tes gagal untuk parsing payload dan copy error**

  Buat `tests/unit/login-contract.test.ts` dengan kasus berikut:

  ```ts
  import { describe, expect, it } from "vitest";
  import {
    getAccountStatusMessage,
    getRoleMismatchMessage,
    parseLoginPayload,
  } from "@/lib/auth/login-contract";

  describe("parseLoginPayload", () => {
    it("normalizes a valid login payload", () => {
      expect(parseLoginPayload({
        email: "  USER@Example.COM ",
        password: "password123",
        role: "supplier",
      })).toEqual({
        ok: true,
        value: {
          email: "user@example.com",
          password: "password123",
          role: "supplier",
        },
      });
    });

    it.each([
      [{ email: "invalid", password: "password123", role: "umkm" }, "email"],
      [{ email: "user@example.com", password: "", role: "umkm" }, "password"],
      [{ email: "user@example.com", password: "password123", role: "owner" }, "role"],
    ])("rejects invalid input", (input, field) => {
      const result = parseLoginPayload(input);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors[field]).toBeTruthy();
    });
  });

  describe("login feedback", () => {
    it("maps inactive account statuses to Indonesian messages", () => {
      expect(getAccountStatusMessage("suspended_temporary"))
        .toBe("Akun Anda sedang ditangguhkan sementara.");
      expect(getAccountStatusMessage("suspended_permanent"))
        .toBe("Akun Anda ditangguhkan permanen. Hubungi Admin Wesup.");
      expect(getAccountStatusMessage("banned"))
        .toBe("Akun Anda diblokir. Hubungi Admin Wesup.");
    });

    it("explains pending supplier verification without granting supplier role", () => {
      expect(getRoleMismatchMessage("supplier", "pending"))
        .toBe("Pendaftaran pemasok Anda masih menunggu verifikasi Admin.");
    });
  });
  ```

- [ ] **Step 2: Jalankan tes dan pastikan RED**

  Run:

  ```bash
  npm test -- tests/unit/login-contract.test.ts
  ```

  Expected: FAIL karena `@/lib/auth/login-contract` belum ada.

- [ ] **Step 3: Implementasikan kontrak minimal**

  Buat `lib/auth/login-contract.ts` dengan bentuk publik berikut:

  ```ts
  import type { AccountStatus, UserRole, VerificationStatus } from "@/types/database";

  export const LOGIN_ROLES = ["admin", "umkm", "supplier"] as const;
  export type LoginRole = (typeof LOGIN_ROLES)[number];

  export interface LoginRequest {
    email: string;
    password: string;
    role: LoginRole;
  }

  export interface LoginFieldErrors {
    email?: string;
    password?: string;
    role?: string;
  }

  export interface LoginSuccessResponse {
    user: { email: string };
    profile: {
      role: UserRole;
      status: AccountStatus;
      fullName: string;
    };
    redirectTo: string;
  }

  export interface LoginErrorResponse {
    error: string;
    code?: "invalid_credentials" | "inactive_account" | "role_mismatch" |
      "supplier_pending" | "supplier_rejected" | "profile_unavailable";
    fieldErrors?: LoginFieldErrors;
  }

  export const LOGIN_REDIRECT_BY_ROLE: Record<LoginRole, string> = {
    admin: "/",
    umkm: "/",
    supplier: "/",
  };

  export type ParseLoginPayloadResult =
    | { ok: true; value: LoginRequest }
    | { ok: false; fieldErrors: LoginFieldErrors };

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  export function parseLoginPayload(input: unknown): ParseLoginPayloadResult {
    const body = input && typeof input === "object"
      ? input as Record<string, unknown>
      : {};
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = typeof body.role === "string" ? body.role : "";
    const fieldErrors: LoginFieldErrors = {};

    if (!EMAIL_PATTERN.test(email)) fieldErrors.email = "Masukkan alamat email yang valid.";
    if (!password) fieldErrors.password = "Password wajib diisi.";
    if (!LOGIN_ROLES.includes(role as LoginRole)) fieldErrors.role = "Pilih jenis akun untuk login.";

    if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
    return { ok: true, value: { email, password, role: role as LoginRole } };
  }
  ```

  Tambahkan `getAccountStatusMessage(status)` dengan tiga copy persis dari tes. Tambahkan `getRoleMismatchMessage(role, verificationStatus?)` dengan aturan: `supplier + pending` memberi pesan menunggu, `supplier + rejected` memberi pesan belum disetujui, dan selain itu memberi `Akun ini tidak terdaftar sebagai <label role>.`.

- [ ] **Step 4: Jalankan tes dan pastikan GREEN**

  Run:

  ```bash
  npm test -- tests/unit/login-contract.test.ts
  ```

  Expected: seluruh tes kontrak PASS.

- [ ] **Step 5: Commit kontrak**

  ```bash
  git add lib/auth/login-contract.ts tests/unit/login-contract.test.ts
  git commit -m "test(auth): define role login contract"
  ```

---

### Task 2: Perkuat Route Handler login dengan role dan status database

**Files:**
- Modify: `tests/unit/api-auth.test.ts`
- Modify: `app/api/auth/login/route.ts`

**Interfaces:**
- Consumes: `parseLoginPayload()`, `LOGIN_REDIRECT_BY_ROLE`, helper feedback dari Task 1, `getCurrentUser()`/`AuthClient` dari `lib/supabase/auth.ts`, dan server client dari `lib/supabase/server.ts`.
- Produces: `POST /api/auth/login` dengan request `{ email, password, role }`, success `LoginSuccessResponse`, dan failure `LoginErrorResponse`.

- [ ] **Step 1: Perluas mock login pada tes API**

  Buat helper mock yang mendukung `auth.signInWithPassword`, `auth.getUser`, `auth.signOut`, query `profiles`, dan query `supplier_profiles.verification_status`. Jangan memakai service-role key; seluruh lookup dilakukan sebagai user yang baru terautentikasi dan mengikuti RLS own-row.

- [ ] **Step 2: Tulis tes gagal untuk kontrak login baru**

  Ganti kasus sukses lama dan tambahkan kasus berikut pada blok `POST /api/auth/login`:

  1. UMKM aktif + selected role `umkm` menghasilkan 200, profil resmi, dan `redirectTo: "/"`.
  2. Payload tanpa role menghasilkan 400 + `fieldErrors.role`, tanpa memanggil Supabase Auth.
  3. Kredensial salah menghasilkan 401 + `{ code: "invalid_credentials", error: "Email atau password salah." }`; pesan mentah Supabase tidak diteruskan.
  4. Profil tidak ditemukan setelah password benar menghasilkan 500 `profile_unavailable` dan memanggil `signOut()`.
  5. Status `suspended_temporary`, `suspended_permanent`, serta `banned` masing-masing menghasilkan 403 `inactive_account` dan memanggil `signOut()`.
  6. Role database `umkm` tetapi user memilih `admin` menghasilkan 403 `role_mismatch` dan memanggil `signOut()`.
  7. User memilih `supplier`, role masih `umkm`, dan `supplier_profiles.verification_status = pending` menghasilkan 403 `supplier_pending`, pesan menunggu verifikasi, dan `signOut()`.
  8. Cabang supplier `rejected` menghasilkan 403 `supplier_rejected` dan `signOut()`.
  9. Supplier `approved` yang role database-nya sudah `supplier` menghasilkan 200 tanpa lookup fallback verifikasi.

- [ ] **Step 3: Jalankan blok tes login dan pastikan RED**

  Run:

  ```bash
  npm test -- tests/unit/api-auth.test.ts -t "POST /api/auth/login"
  ```

  Expected: FAIL karena Route Handler lama belum menerima role, belum membaca profil, dan masih meneruskan pesan mentah Supabase.

- [ ] **Step 4: Implementasikan alur server secara berurutan**

  Ubah `POST` dengan urutan yang tidak boleh dibalik:

  ```ts
  const rawBody = await request.json();
  const parsed = parseLoginPayload(rawBody);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Periksa kembali data login Anda.", fieldErrors: parsed.fieldErrors },
      { status: 400 },
    );
  }

  const { email, password, role: selectedRole } = parsed.value;
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    return NextResponse.json(
      { code: "invalid_credentials", error: "Email atau password salah." },
      { status: 401 },
    );
  }

  const context = await getCurrentUser(client as unknown as AuthClient);
  ```

  Setelah itu:

  - Jika `context` null: `await client.auth.signOut()`, lalu 500 `profile_unavailable`.
  - Jika `context.status !== "active"`: simpan pesan status, `signOut()`, lalu 403 `inactive_account`.
  - Jika `context.role !== selectedRole` dan selected role bukan supplier: `signOut()`, lalu 403 `role_mismatch`.
  - Jika selected role supplier tetapi role database belum supplier: query own row `supplier_profiles.select("verification_status").eq("user_id", context.userId).maybeSingle()`, susun code/message pending/rejected/default, kemudian `signOut()` dan 403.
  - Jika seluruh pemeriksaan lolos: kembalikan email, `context.role`, `context.status`, `context.fullName`, dan `LOGIN_REDIRECT_BY_ROLE[selectedRole]`.

  Jangan mengubah `profiles.role`, `app_metadata`, atau `user_metadata` dari endpoint ini.

- [ ] **Step 5: Jalankan seluruh tes API auth**

  Run:

  ```bash
  npm test -- tests/unit/api-auth.test.ts
  ```

  Expected: seluruh tes signup/login/logout/session/reset password tetap PASS.

- [ ] **Step 6: Commit Route Handler**

  ```bash
  git add app/api/auth/login/route.ts tests/unit/api-auth.test.ts
  git commit -m "feat(auth): enforce role-aware login"
  ```

---

### Task 3: Bangun formulir login interaktif bertema biru

**Files:**
- Create: `components/auth/LoginForm.tsx`
- Modify: `app/login/page.tsx`

**Interfaces:**
- Consumes: `LOGIN_ROLES`, `LoginRole`, `LoginSuccessResponse`, `LoginErrorResponse`, `useToast()`, `useRouter()`, dan `POST /api/auth/login`.
- Produces: form aksesibel dengan state `email`, `password`, `role`, `showPassword`, `submitting`, `fieldErrors`, dan `globalError`.

- [ ] **Step 1: Ubah halaman menjadi server-rendered visual shell**

  `app/login/page.tsx` harus:

  - Mengekspor metadata `title: "Masuk"` dan deskripsi login Wesup.
  - Memakai background yang sama dengan halaman register:
    `min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_38%),linear-gradient(180deg,_#f8fafc,_#eff6ff)]`.
  - Menampilkan badge `Wesup`, judul `Masuk ke akun Anda`, subtitle singkat, dan kartu putih maksimal sekitar `max-w-xl`.
  - Merender `<LoginForm />` di dalam kartu.
  - Menyediakan link sekunder kembali ke `/`.

- [ ] **Step 2: Implementasikan role selector aksesibel**

  Buat `components/auth/LoginForm.tsx` sebagai Client Component. Gunakan `<fieldset>` + `<legend>Login sebagai</legend>` dan tiga native radio input dengan label kartu:

  - Admin — icon `ShieldCheck`, keterangan `Kelola dan moderasi platform`.
  - UMKM — icon `Store`, keterangan `Belanja bahan baku bersama`.
  - Supplier — icon `Truck`, keterangan `Kelola penawaran dan pesanan`.

  Set nilai awal role ke `"umkm"`. Kartu aktif memakai `border-blue-500 bg-blue-50 text-blue-700`; kartu lain memakai `border-slate-200 bg-white` dengan hover biru muda. Pada viewport kecil kartu tersusun satu kolom, dan pada layar lebih lebar tiga kolom.

- [ ] **Step 3: Implementasikan input dan feedback**

  Tambahkan:

  - Email dengan `type="email"`, `autoComplete="email"`, icon `Mail`, dan error per-field.
  - Password dengan `autoComplete="current-password"`, tombol `Eye`/`EyeOff`, `aria-label` dinamis, serta padding kanan agar icon tidak menimpa teks.
  - Alert global merah dengan `role="alert"`.
  - Tombol submit biru selebar penuh; saat submit disable seluruh kontrol yang relevan, tampilkan `LoaderCircle` beranimasi dan teks `Sedang masuk…`.
  - Link `Daftar sebagai Supplier` ke `/supplier/register` dan link `Kembali ke beranda` ke `/`.

  Hapus error field terkait ketika user mengubah nilai. Jangan hapus password karena error role/status; biarkan user mengganti pilihan role tanpa mengetik ulang.

- [ ] **Step 4: Hubungkan submit ke Route Handler**

  Pada `onSubmit`:

  ```ts
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, role }),
  });
  const body = await response.json() as LoginSuccessResponse | LoginErrorResponse;
  ```

  - Respons gagal: tampilkan `fieldErrors` dan `error` dari API; tetap di halaman login.
  - Network/JSON failure: tampilkan `Koneksi bermasalah. Periksa internet Anda lalu coba lagi.`.
  - Respons sukses: tampilkan toast `Berhasil masuk sebagai <Role>.`, panggil `router.replace(body.redirectTo)`, lalu `router.refresh()` agar Server Components membaca cookie sesi baru.
  - Bungkus proses dengan `try/catch/finally` agar `submitting` selalu kembali false bila navigasi tidak terjadi.

- [ ] **Step 5: Verifikasi UI secara manual**

  Run:

  ```bash
  npm run dev
  ```

  Periksa `/login` pada 360×800 dan 1440×900:

  - Tidak ada horizontal overflow.
  - Ketiga role dapat dipilih dengan mouse dan keyboard.
  - Focus ring terlihat.
  - Tombol mata tidak men-submit form.
  - Enter pada password men-submit tepat sekali.
  - Loading mencegah double-submit.
  - Error API tetap terbaca tanpa menggeser layout secara berlebihan.
  - Warna utama tetap biru, bukan hijau.

- [ ] **Step 6: Commit UI login**

  ```bash
  git add app/login/page.tsx components/auth/LoginForm.tsx
  git commit -m "feat(login): add role-based sign-in form"
  ```

---

### Task 4: Verifikasi integrasi sesi dan dokumentasikan bukti

**Files:**
- Create: `docs/testing/role-login.tdd.md`

**Interfaces:**
- Consumes: seluruh implementasi dan tes dari Task 1–3.
- Produces: bukti verifikasi yang dapat diaudit dan daftar perilaku end-to-end.

- [ ] **Step 1: Jalankan unit tests yang relevan**

  ```bash
  npm test -- tests/unit/login-contract.test.ts tests/unit/api-auth.test.ts tests/unit/auth.test.ts
  ```

  Expected: PASS seluruh kontrak login, Route Handler auth, dan helper role/status lama.

- [ ] **Step 2: Jalankan regresi penuh**

  ```bash
  npm test
  npm run lint
  npm run build
  ```

  Expected: ketiganya exit code 0. Live tests yang membutuhkan kredensial tetap mengikuti mekanisme skip repository.

- [ ] **Step 3: Uji alur terhadap Supabase development**

  Dengan kredensial non-produksi yang memang tersedia, verifikasi:

  1. UMKM aktif + pilihan UMKM berhasil dan `GET /api/auth/session` mengembalikan role `umkm`.
  2. Admin seeded + pilihan Admin berhasil dan session mengembalikan role `admin`.
  3. Supplier approved + pilihan Supplier berhasil dan session mengembalikan role `supplier`.
  4. Supplier pending + pilihan Supplier ditolak dengan pesan menunggu verifikasi; sesudahnya session endpoint mengembalikan 401.
  5. Role tidak cocok ditolak; sesudahnya session endpoint mengembalikan 401.
  6. Akun suspended/banned ditolak; sesudahnya session endpoint mengembalikan 401.
  7. Password salah hanya menampilkan pesan generik.

- [ ] **Step 4: Tulis laporan TDD**

  Buat `docs/testing/role-login.tdd.md` berisi:

  - Scope dan requirement yang diuji.
  - Perintah RED beserta alasan kegagalan awal.
  - Perintah GREEN beserta jumlah test aktual yang lulus.
  - Hasil `npm test`, `npm run lint`, dan `npm run build` dengan exit code aktual.
  - Checklist QA manual di Task 3 dan Task 4, tanpa email/password nyata atau secret environment.

- [ ] **Step 5: Commit bukti verifikasi**

  ```bash
  git add docs/testing/role-login.tdd.md
  git commit -m "docs(testing): record role login verification"
  ```

---

## Acceptance Criteria

- `/login` bukan lagi placeholder dan tampil konsisten dengan halaman `/supplier/register` menggunakan tema biru.
- User dapat memilih Admin, UMKM, atau Supplier, mengisi email/password, melihat/menyembunyikan password, dan menerima loading/error yang jelas.
- Browser tidak pernah menetapkan atau mengubah role; Route Handler membandingkan pilihan user dengan `profiles.role`.
- Login supplier pending/rejected memberi feedback yang sesuai tanpa memberikan hak supplier.
- Login role mismatch, akun suspended, dan akun banned membersihkan sesi sebelum mengembalikan 403.
- Kredensial salah tidak membocorkan detail Supabase atau apakah email terdaftar.
- Login sukses menyimpan cookie Supabase SSR, menampilkan toast, dan mengarahkan ke `/` tanpa 404.
- API session dan seluruh auth tests lama tetap bekerja.
- `npm test`, `npm run lint`, dan `npm run build` lulus.

## Deliberately Out of Scope

- Dashboard Admin/UMKM/Supplier dan pemetaan redirect ke dashboard tersebut.
- Halaman UI forgot/reset password.
- Registrasi UMKM baru.
- Perubahan role, approval supplier, atau migration/RLS baru.
- Social login, MFA, remember-me berbasis penyimpanan password, dan CAPTCHA.
