# Dokumentasi Environment Variables

> **Project:** Marketplace B2B Supplier-UMKM dengan Escrow  
> **Stack:** Next.js 14 (App Router) · Supabase · Upstash · Vercel · Midtrans · Fonnte  
> **Versi:** 1.0.0  
> **Terakhir Update:** 4 Agustus 2026

---

## File Konfigurasi

Buat file `.env.local` di root project Next.js. **Jangan pernah commit file ini ke repository!**

```bash
# Tambahkan ke .gitignore
.env.local
.env.*.local
```

---

## 1. Supabase (Database & Auth)

| Variable                        | Deskripsi                                     | Contoh Value                 | Diperoleh Dari                                             |
| ------------------------------- | --------------------------------------------- | ---------------------------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | URL endpoint Supabase project                 | `https://abc123.supabase.co` | Supabase Dashboard → Project Settings → API                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key untuk client-side auth        | `eyJhbGciOiJIUzI1NiIs...`    | Supabase Dashboard → Project Settings → API                |
| `SUPABASE_SERVICE_ROLE_KEY`     | Service role key untuk server-side opsi admin | `eyJhbGciOiJIUzI1NiIs...`    | Supabase Dashboard → Project Settings → API                |
| `SUPABASE_JWT_SECRET`           | Secret untuk verifikasi JWT token             | `super-secret-jwt-key-2026`  | Supabase Dashboard → Project Settings → API → JWT Settings |

### Catatan Keamanan

- `SUPABASE_SERVICE_ROLE_KEY` memiliki hak akses penuh (bypass RLS). **Hanya digunakan di server-side API routes / Server Actions.**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` aman untuk client-side karena terbatas oleh Row Level Security (RLS).

---

## 2. Upstash (Redis & Queue)

| Variable                             | Deskripsi                                   | Contoh Value                            | Diperoleh Dari                             |
| ------------------------------------ | ------------------------------------------- | --------------------------------------- | ------------------------------------------ |
| `UPSTASH_REDIS_REST_URL`             | URL REST endpoint Redis Upstash             | `https://valid-mantis-12345.upstash.io` | Upstash Console → Redis → Database Details |
| `UPSTASH_REDIS_REST_TOKEN`           | Token autentikasi REST Redis                | `AZJaACQgM...`                          | Upstash Console → Redis → Database Details |
| `UPSTASH_QSTASH_TOKEN`               | Token untuk scheduled jobs & queue          | `qstash_token_xxx`                      | Upstash Console → QStash → Tokens          |
| `UPSTASH_QSTASH_CURRENT_SIGNING_KEY` | Signing key untuk verifikasi webhook QStash | `sig_xxx`                               | Upstash Console → QStash → Signing Keys    |
| `UPSTASH_QSTASH_NEXT_SIGNING_KEY`    | Next signing key (rotasi)                   | `sig_yyy`                               | Upstash Console → QStash → Signing Keys    |

### Catatan Keamanan

- Gunakan `UPSTASH_REDIS_REST_TOKEN` untuk implementasi **Distributed Lock** (`SETNX`) dan rate limiting.
- `UPSTASH_QSTASH_TOKEN` digunakan untuk enqueue background jobs (Lazy Evaluation).

---

## 3. Midtrans (Payment Gateway)

| Variable                  | Deskripsi                                 | Contoh Value                  | Diperoleh Dari                              |
| ------------------------- | ----------------------------------------- | ----------------------------- | ------------------------------------------- |
| `MIDTRANS_SERVER_KEY`     | Server key untuk charge transaction       | `Mid-server-abc123...`        | Midtrans Dashboard → Settings → Access Keys |
| `MIDTRANS_CLIENT_KEY`     | Client key untuk Snap UI                  | `Mid-client-xyz789...`        | Midtrans Dashboard → Settings → Access Keys |
| `MIDTRANS_MERCHANT_ID`    | ID merchant Midtrans                      | `G123456789`                  | Midtrans Dashboard → Settings → Profile     |
| `MIDTRANS_IS_PRODUCTION`  | Toggle sandbox/production                 | `false` (dev) / `true` (prod) | —                                           |
| `MIDTRANS_WEBHOOK_SECRET` | Secret untuk verifikasi signature webhook | `whsec_xxx`                   | Midtrans Dashboard → Settings → Webhooks    |

### Catatan Keamanan

- `MIDTRANS_SERVER_KEY` **hanya boleh ada di server-side**. Jangan expose ke client.
- Gunakan `MIDTRANS_IS_PRODUCTION=false` untuk development & staging.
- Verifikasi signature webhook menggunakan `MIDTRANS_WEBHOOK_SECRET` untuk mencegah request palsu.

---

## 4. Fonnte (WhatsApp Gateway)

| Variable                | Deskripsi                              | Contoh Value       | Diperoleh Dari                      |
| ----------------------- | -------------------------------------- | ------------------ | ----------------------------------- |
| `FONNTE_API_TOKEN`      | Token API untuk kirim WhatsApp         | `token_abc123...`  | Fonnte Dashboard → Devices → Token  |
| `FONNTE_DEVICE_ID`      | ID device yang terdaftar               | `device_12345`     | Fonnte Dashboard → Devices          |
| `FONNTE_WEBHOOK_SECRET` | Secret verifikasi webhook status pesan | `fonnte_whsec_xxx` | Fonnte Dashboard → Webhook Settings |

### Catatan Keamanan

- Simpan `FONNTE_API_TOKEN` di server-side only.
- Gunakan webhook untuk tracking status pengiriman notifikasi (terkirim, dibaca, gagal).

---

## 5. Vercel (Deployment & Edge)

| Variable      | Deskripsi                             | Contoh Value                             | Diperoleh Dari                                          |
| ------------- | ------------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| `VERCEL_URL`  | URL deployment (auto-set oleh Vercel) | `my-app.vercel.app`                      | Vercel Dashboard → Project Settings                     |
| `VERCEL_ENV`  | Environment stage (auto-set)          | `development` / `preview` / `production` | Auto-set oleh Vercel                                    |
| `CRON_SECRET` | Secret untuk proteksi cron job routes | `cron_secret_xxx`                        | Generate manual, simpan di Vercel Environment Variables |

### Catatan Keamanan

- `CRON_SECRET` digunakan untuk memastikan hanya Vercel Cron yang bisa mengakses endpoint `/api/cron/*`.
- Gunakan `VERCEL_ENV` untuk conditional logic (misal: log level, feature flags).

---

## 6. Aplikasi Internal

| Variable         | Deskripsi                                           | Contoh Value                             |
| ---------------- | --------------------------------------------------- | ---------------------------------------- |
| `APP_NAME`       | Nama aplikasi                                       | `Marketplace B2B`                        |
| `APP_URL`        | Base URL aplikasi                                   | `https://marketplace-b2b.vercel.app`     |
| `APP_ENV`        | Environment app                                     | `development` / `staging` / `production` |
| `ENCRYPTION_KEY` | Key untuk enkripsi data sensitif (rekening, KTP)    | `base64:32char_random_string`            |
| `JWT_SECRET`     | Secret untuk custom JWT (jika tidak pakai Supabase) | `app_jwt_secret_2026`                    |
| `SESSION_SECRET` | Secret untuk session management                     | `session_secret_xxx`                     |

---

## Template Lengkap `.env.local`

```bash
# ============================================================
# SUPABASE
# ============================================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_JWT_SECRET=your-jwt-secret

# ============================================================
# UPSTASH (Redis + QStash)
# ============================================================
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
UPSTASH_QSTASH_TOKEN=your-qstash-token
UPSTASH_QSTASH_CURRENT_SIGNING_KEY=sig_current
UPSTASH_QSTASH_NEXT_SIGNING_KEY=sig_next

# ============================================================
# MIDTRANS (Payment Gateway)
# ============================================================
MIDTRANS_SERVER_KEY=Mid-server-xxx
MIDTRANS_CLIENT_KEY=Mid-client-xxx
MIDTRANS_MERCHANT_ID=G123456789
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_WEBHOOK_SECRET=whsec_xxx

# ============================================================
# FONNTE (WhatsApp Gateway)
# ============================================================
FONNTE_API_TOKEN=token_xxx
FONNTE_DEVICE_ID=device_xxx
FONNTE_WEBHOOK_SECRET=fonnte_whsec_xxx

# ============================================================
# VERCEL
# ============================================================
VERCEL_URL=localhost:3000
VERCEL_ENV=development
CRON_SECRET=cron_secret_xxx

# ============================================================
# APP INTERNAL
# ============================================================
APP_NAME=Marketplace B2B
APP_URL=http://localhost:3000
APP_ENV=development
ENCRYPTION_KEY=base64:your-32-char-key-here
JWT_SECRET=app_jwt_secret_2026
SESSION_SECRET=session_secret_xxx
```

---

## Panduan Berbagi ke Tim

1. **Jangan share via chat umum** (WhatsApp grup, Slack publik).
2. Gunakan **password manager bersama** (1Password, Bitwarden, atau LastPass Teams).
3. Untuk onboarding anggota baru:
   - Berikan akses read-only ke password manager.
   - Minta mereka generate `.env.local` sendiri dari vault.
4. **Rotasi key** setiap 90 hari atau jika ada anggota tim yang keluar.
5. Enable **audit log** di Supabase, Midtrans, dan Upstash untuk tracking penggunaan key.

---

## Environment per Stage

| Stage           | File            | `APP_ENV`     | `MIDTRANS_IS_PRODUCTION` | Database                     |
| --------------- | --------------- | ------------- | ------------------------ | ---------------------------- |
| Local Dev       | `.env.local`    | `development` | `false`                  | Supabase local / dev project |
| Staging/Preview | Vercel Env Vars | `staging`     | `false`                  | Supabase staging project     |
| Production      | Vercel Env Vars | `production`  | `true`                   | Supabase production project  |
