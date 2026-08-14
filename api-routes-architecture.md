# Dokumentasi Arsitektur API Routes

> **Project:** Marketplace B2B Supplier-UMKM dengan Escrow  
> **Framework:** Next.js 16 App Router (`app/api/*`)  
> **Versi:** 1.0.0  
> **Terakhir Update:** 4 Agustus 2026

---

## Struktur Direktori API

```
app/api/
├── auth/
│   ├── login/route.ts              # POST   - Login via Supabase Auth
│   ├── register/supplier/route.ts  # POST   - Registrasi Supplier
│   ├── register/umkm/route.ts      # POST   - Registrasi UMKM
│   └── logout/route.ts             # POST   - Logout & invalidate session
│
├── suppliers/
│   ├── route.ts                    # GET    - List supplier (public)
│   ├── [id]/route.ts               # GET    - Detail supplier
│   ├── [id]/catalog/route.ts       # GET    - Katalog produk supplier
│   ├── [id]/verify/route.ts        # PATCH  # Admin verifikasi supplier
│   └── me/route.ts                 # GET    - Profile supplier yang login
│
├── umkm/
│   ├── route.ts                    # GET    - List UMKM (admin only)
│   ├── [id]/route.ts               # GET    - Detail UMKM
│   ├── [id]/verify/route.ts        # PATCH  # Admin verifikasi UMKM
│   └── me/route.ts                 # GET    - Profile UMKM yang login
│
├── catalog/
│   ├── route.ts                    # GET    - List semua produk (public)
│   ├── [productId]/route.ts        # GET    - Detail produk
│   └── [productId]/lock/route.ts   # POST   # 🔒 Penguncian harga (CRITICAL)
│
├── locks/
│   ├── route.ts                    # GET    - List lock aktif user
│   ├── [lockId]/route.ts           # GET    - Detail lock
│   ├── [lockId]/pay/route.ts       # POST   # Inisiasi pembayaran Midtrans
│   └── [lockId]/cancel/route.ts    # POST   # Batal lock & refund saldo
│
├── payments/
│   ├── midtrans/
│   │   └── webhook/route.ts        # POST   # Webhook notifikasi Midtrans
│   └── [paymentId]/status/route.ts # GET    - Cek status pembayaran
│
├── escrow/
│   ├── [escrowId]/release/route.ts # POST   # 🔓 Release dana ke supplier (CRITICAL)
│   ├── [escrowId]/hold/route.ts    # POST   # Hold dana (dispute)
│   └── [escrowId]/refund/route.ts  # POST   # Refund dana ke UMKM
│
├── orders/
│   ├── route.ts                    # GET    - List order user
│   ├── [orderId]/route.ts          # GET    - Detail order
│   ├── [orderId]/ship/route.ts     # PATCH  # Supplier update resi & status shipped
│   └── [orderId]/receive/route.ts  # PATCH  # UMKM konfirmasi terima barang
│
├── notifications/
│   ├── whatsapp/
│   │   └── webhook/route.ts        # POST   # Webhook status pesan Fonnte
│   └── send/route.ts               # POST   # Kirim notifikasi manual (admin)
│
├── admin/
│   ├── dashboard/route.ts          # GET    # Metrics & analytics
│   ├── disputes/
│   │   ├── route.ts                # GET    # List dispute
│   │   └── [disputeId]/resolve/route.ts  # PATCH  # Resolusi dispute
│   └── users/
│       └── route.ts                # GET    # List semua user
│
├── cron/
│   ├── expire-locks/route.ts       # GET    # ⏰ Auto-expire lock lewat waktu
│   ├── expire-payments/route.ts    # GET    # ⏰ Auto-cancel payment pending
│   └── release-escrow/route.ts     # GET    # ⏰ Auto-release escrow (grace period)
│
└── health/route.ts                 # GET    - Health check endpoint
```

---

## Mekanisme Keamanan Global

### 1. Autentikasi & Autorisasi

Setiap API route (kecuali public endpoints) menggunakan pattern berikut:

```typescript
// app/api/_lib/auth.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function requireAuth() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (!session || error) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return session;
}

export async function requireRole(allowedRoles: string[]) {
  const session = await requireAuth();
  const userRole = session.user.user_metadata.role;

  if (!allowedRoles.includes(userRole)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return session;
}
```

### 2. Rate Limiting (Upstash Redis)

```typescript
// app/api/_lib/rate-limit.ts
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function rateLimit(
  identifier: string, // IP atau userId
  maxRequests: number = 10, // Maks request
  windowSeconds: number = 60, // Window waktu (detik)
) {
  const key = `rate_limit:${identifier}`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }

  if (current > maxRequests) {
    const ttl = await redis.ttl(key);
    return {
      allowed: false,
      retryAfter: ttl,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    remaining: maxRequests - current,
  };
}
```

---

## Mekanisme Kritis: Lazy Evaluation & Distributed Lock

### Masalah: Race Condition

Dalam sistem marketplace B2B, **race condition** dapat terjadi pada:

1. **Pendaftaran / Penguncian Harga** — Dua UMKM mengunci produk yang sama secara bersamaan saat stok tersisa 1.
2. **Penutupan Batas Waktu** — Cron job expire lock berjalan bersamaan dengan user yang membayar di detik terakhir.
3. **Pencairan Dana** — Dua request release escrow diproses bersamaan untuk order yang sama.

### Solusi 1: Distributed Lock dengan Redis SETNX

#### Konsep

```
SET lock:{resource_id} {unique_value} NX EX {ttl_seconds}
```

| Flag | Arti               | Fungsi                                           |
| ---- | ------------------ | ------------------------------------------------ |
| `NX` | Only if Not eXists | Lock hanya di-set jika key belum ada             |
| `EX` | EXpire             | Auto-delete lock setelah TTL (mencegah deadlock) |

#### Implementasi Lock Manager

```typescript
// app/api/_lib/distributed-lock.ts
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Distributed Lock menggunakan Redis SETNX
 * @param resourceId - ID resource yang akan di-lock (e.g., "product:123")
 * @param ttlSeconds - Waktu hidup lock (default 30 detik)
 * @returns Lock token jika berhasil, null jika gagal
 */
export async function acquireLock(
  resourceId: string,
  ttlSeconds: number = 30,
): Promise<string | null> {
  const lockKey = `lock:${resourceId}`;
  const lockToken = `lock_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // SET key value NX EX ttl
  const result = await redis.set(lockKey, lockToken, {
    nx: true, // Only set if Not eXists
    ex: ttlSeconds, // Auto-expire
  });

  if (result === "OK") {
    return lockToken;
  }

  return null; // Lock sudah dimiliki proses lain
}

/**
 * Release lock dengan verifikasi token (safe release)
 * @param resourceId - ID resource
 * @param lockToken - Token yang didapat saat acquire
 */
export async function releaseLock(
  resourceId: string,
  lockToken: string,
): Promise<boolean> {
  const lockKey = `lock:${resourceId}`;

  // Lua script untuk atomic compare-and-delete
  // Mencegah "release lock orang lain" (stolen lock)
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  const result = await redis.eval(script, [lockKey], [lockToken]);
  return result === 1;
}

/**
 * Extend lock TTL (untuk operasi panjang)
 */
export async function extendLock(
  resourceId: string,
  lockToken: string,
  additionalSeconds: number,
): Promise<boolean> {
  const lockKey = `lock:${resourceId}`;

  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("expire", KEYS[1], ARGV[2])
    else
      return 0
    end
  `;

  const result = await redis.eval(
    script,
    [lockKey],
    [lockToken, additionalSeconds],
  );
  return result === 1;
}
```

#### Alur Lock pada Endpoint Penguncian Harga

```
UMKM A ──req──> POST /api/catalog/123/lock
                    │
                    ▼
            [1] ACQUIRE LOCK
            SET lock:product:123 "token_a" NX EX 30
                    │
                    ▼
            [2] CHECK STOK & SALDO
            (dalam transaction Supabase)
                    │
                    ▼
            [3] CREATE LOCK RECORD
            INSERT INTO price_locks (...)
                    │
                    ▼
            [4] DEDUCT SALDO ESCROW
            UPDATE umkm_wallets SET balance = balance - amount
                    │
                    ▼
            [5] DECREMENT STOK VIRTUAL
            UPDATE products SET virtual_stock = virtual_stock - qty
                    │
                    ▼
            [6] RELEASE LOCK
            DEL lock:product:123 (jika token cocok)
                    │
                    ▼
            Response 200 + Lock ID

UMKM B ──req──> POST /api/catalog/123/lock  (bersamaan)
                    │
                    ▼
            [1] ACQUIRE LOCK
            SET lock:product:123 "token_b" NX EX 30
                    │
            GAGAL — key sudah ada!
                    │
                    ▼
            RETRY / QUEUE (Lazy Evaluation)
                    │
                    ▼
            Enqueue ke QStash
            (diproses setelah lock UMKM A selesai)
```

---

### Solusi 2: Lazy Evaluation dengan Upstash QStash

#### Konsep

Lazy Evaluation menunda eksekusi tugas yang tidak perlu real-time ke background queue. Digunakan untuk:

1. **Retry lock yang gagal** — Jika acquire lock gagal, enqueue ke QStash untuk retry nanti.
2. **Notifikasi WhatsApp** — Kirim notifikasi via Fonnte tidak blocking response API.
3. **Generate PDF kontrak** — Generate digital contract di background.
4. **Update analytics** — Hitung metrics dashboard tidak blocking transaksi utama.

#### Implementasi Queue Manager

```typescript
// app/api/_lib/queue.ts
import { Client } from "@upstash/qstash";

const qstash = new Client({
  token: process.env.UPSTASH_QSTASH_TOKEN!,
});

/**
 * Enqueue task ke background queue
 */
export async function enqueueTask(
  endpoint: string, // e.g., "/api/jobs/send-notification"
  payload: object,
  options?: {
    delay?: number; // Delay dalam detik
    retries?: number; // Max retry attempts
    deduplicationId?: string; // ID untuk mencegah duplikat
  },
) {
  const url = `${process.env.APP_URL}${endpoint}`;

  return await qstash.publishJSON({
    url,
    body: payload,
    delay: options?.delay ? options.delay : undefined,
    retries: options?.retries ?? 3,
    deduplicationId: options?.deduplicationId,
  });
}

/**
 * Schedule recurring job (cron via QStash)
 */
export async function scheduleRecurring(
  endpoint: string,
  cron: string, // e.g., "0 */6 * * *" (setiap 6 jam)
  payload?: object,
) {
  const url = `${process.env.APP_URL}${endpoint}`;

  return await qstash.schedules.create({
    destination: url,
    cron,
    body: payload ? JSON.stringify(payload) : undefined,
  });
}
```

#### Endpoint Penguncian Harga dengan Lock + Lazy Evaluation

```typescript
// app/api/catalog/[productId]/lock/route.ts
import { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { acquireLock, releaseLock } from "@/app/api/_lib/distributed-lock";
import { enqueueTask } from "@/app/api/_lib/queue";
import { rateLimit } from "@/app/api/_lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: { productId: string } },
) {
  const productId = params.productId;
  const supabase = createRouteHandlerClient({ cookies });

  // ──[1] AUTH & RATE LIMITING─────────────────────────────
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rate = await rateLimit(session.user.id, 5, 60);
  if (!rate.allowed) {
    return Response.json(
      { error: "Rate limit exceeded", retryAfter: rate.retryAfter },
      { status: 429 },
    );
  }

  const body = await request.json();
  const { quantity, lockDurationHours = 24 } = body;
  const umkmId = session.user.id;

  // ──[2] ACQUIRE DISTRIBUTED LOCK─────────────────────────
  const lockToken = await acquireLock(`product:${productId}`, 30);

  if (!lockToken) {
    // Lock sedang dimiliki proses lain → Lazy Evaluation
    const dedupId = `lock_retry:${umkmId}:${productId}:${Date.now()}`;

    await enqueueTask(
      "/api/jobs/process-lock-retry",
      {
        umkmId,
        productId,
        quantity,
        lockDurationHours,
        attempt: 1,
      },
      {
        delay: 5, // Retry setelah 5 detik
        retries: 3,
        deduplicationId: dedupId,
      },
    );

    return Response.json(
      {
        status: "queued",
        message:
          "Produk sedang diproses pengguna lain. Request Anda telah dimasukkan ke antrian.",
        retryAfter: 5,
      },
      { status: 202 },
    );
  }

  try {
    // ──[3] VALIDASI BISNIS (dalam transaction)────────────
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, price, virtual_stock, supplier_id, min_order_qty")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.virtual_stock < quantity) {
      return Response.json(
        { error: "Insufficient stock", available: product.virtual_stock },
        { status: 400 },
      );
    }

    if (quantity < product.min_order_qty) {
      return Response.json(
        { error: `Minimum order is ${product.min_order_qty}` },
        { status: 400 },
      );
    }

    // Cek saldo UMKM
    const totalAmount = product.price * quantity;
    const { data: wallet } = await supabase
      .from("umkm_wallets")
      .select("balance")
      .eq("umkm_id", umkmId)
      .single();

    if (!wallet || wallet.balance < totalAmount) {
      return Response.json(
        { error: "Insufficient escrow balance", required: totalAmount },
        { status: 400 },
      );
    }

    // ──[4] EXECUTE TRANSACTION (Atomic)───────────────────
    const lockExpiresAt = new Date();
    lockExpiresAt.setHours(lockExpiresAt.getHours() + lockDurationHours);

    const { data: lockRecord, error: lockError } = await supabase.rpc(
      "create_price_lock",
      {
        p_product_id: productId,
        p_umkm_id: umkmId,
        p_supplier_id: product.supplier_id,
        p_quantity: quantity,
        p_unit_price: product.price,
        p_total_amount: totalAmount,
        p_lock_expires_at: lockExpiresAt.toISOString(),
      },
    );

    if (lockError) {
      throw lockError;
    }

    // ──[5] LAZY EVALUATION: Background Jobs───────────────
    // Kirim notifikasi WhatsApp ke Supplier (non-blocking)
    await enqueueTask(
      "/api/jobs/send-whatsapp",
      {
        to: product.supplier_phone,
        template: "new_lock_notification",
        variables: {
          productName: product.name,
          quantity: quantity,
          umkmName: session.user.user_metadata.company_name,
          lockId: lockRecord.id,
        },
      },
      { deduplicationId: `wa:${lockRecord.id}` },
    );

    // Generate PDF kontrak (non-blocking)
    await enqueueTask(
      "/api/jobs/generate-contract",
      {
        lockId: lockRecord.id,
      },
      { deduplicationId: `contract:${lockRecord.id}` },
    );

    // Update analytics (non-blocking)
    await enqueueTask("/api/jobs/update-metrics", {
      event: "price_lock_created",
      productId,
      amount: totalAmount,
    });

    return Response.json(
      {
        success: true,
        lockId: lockRecord.id,
        expiresAt: lockExpiresAt.toISOString(),
        totalAmount,
        message:
          "Harga berhasil dikunci. Silakan lakukan pembayaran sebelum batas waktu.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Lock creation failed:", error);
    return Response.json(
      { error: "Failed to create lock. Please try again." },
      { status: 500 },
    );
  } finally {
    // ──[6] RELEASE LOCK (selalu dijalankan)───────────────
    await releaseLock(`product:${productId}`, lockToken);
  }
}
```

---

### Endpoint Penutupan Batas Waktu (Expire Lock) dengan Lock

```typescript
// app/api/cron/expire-locks/route.ts
import { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { acquireLock, releaseLock } from "@/app/api/_lib/distributed-lock";

/**
 * Cron job: Auto-expire lock yang sudah lewat batas waktu
 * Dijalankan setiap 5 menit via Vercel Cron
 *
 * Mekanisme Lock: Mencegah race condition antara cron job dan user
 * yang sedang membayar di detik terakhir.
 */
export async function GET(request: NextRequest) {
  // Verifikasi cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  const now = new Date().toISOString();

  // Ambil semua lock yang expired
  const { data: expiredLocks, error } = await supabase
    .from("price_locks")
    .select("id, product_id, umkm_id, quantity, total_amount, status")
    .lt("lock_expires_at", now)
    .eq("status", "active");

  if (error || !expiredLocks || expiredLocks.length === 0) {
    return Response.json({ processed: 0 }, { status: 200 });
  }

  const results = [];

  for (const lock of expiredLocks) {
    // Acquire lock per lock record untuk mencegah race condition
    const lockToken = await acquireLock(`expire_lock:${lock.id}`, 10);

    if (!lockToken) {
      // Lock sedang diproses (mungkin user sedang bayar)
      results.push({ lockId: lock.id, status: "skipped_busy" });
      continue;
    }

    try {
      // Double-check status (pattern: check-then-act)
      const { data: currentLock } = await supabase
        .from("price_locks")
        .select("status")
        .eq("id", lock.id)
        .single();

      if (currentLock?.status !== "active") {
        results.push({ lockId: lock.id, status: "already_processed" });
        continue;
      }

      // Execute expire via database function (atomic)
      const { error: expireError } = await supabase.rpc("expire_price_lock", {
        p_lock_id: lock.id,
      });

      if (expireError) throw expireError;

      // Lazy: Notifikasi ke UMKM
      await enqueueTask("/api/jobs/send-whatsapp", {
        to: lock.umkm_phone,
        template: "lock_expired",
        variables: { lockId: lock.id },
      });

      results.push({ lockId: lock.id, status: "expired" });
    } catch (err) {
      results.push({ lockId: lock.id, status: "error", error: err.message });
    } finally {
      await releaseLock(`expire_lock:${lock.id}`, lockToken);
    }
  }

  return Response.json(
    {
      processed: expiredLocks.length,
      results,
    },
    { status: 200 },
  );
}
```

---

### Endpoint Pencairan Dana Escrow dengan Lock

```typescript
// app/api/escrow/[escrowId]/release/route.ts
import { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { acquireLock, releaseLock } from "@/app/api/_lib/distributed-lock";

/**
 * Release dana escrow ke supplier setelah barang diterima UMKM
 *
 * Race Condition yang dicegah:
 * - UMKM mengklik "Terima Barang" 2x karena double-click
 * - Admin & UMKM release bersamaan
 * - Cron auto-release berjalan bersamaan dengan manual release
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { escrowId: string } },
) {
  const escrowId = params.escrowId;
  const supabase = createRouteHandlerClient({ cookies });

  // Auth: UMKM yang berwenang atau Admin
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userRole = session.user.user_metadata.role;

  // ──[1] ACQUIRE LOCK (idempotency key)───────────────────
  const lockToken = await acquireLock(`escrow_release:${escrowId}`, 60);

  if (!lockToken) {
    return Response.json(
      { error: "Release sedang diproses. Mohon tunggu." },
      { status: 423 }, // Locked
    );
  }

  try {
    // ──[2] VALIDASI STATUS ESCROW─────────────────────────
    const { data: escrow, error: escrowError } = await supabase
      .from("escrows")
      .select(
        `
        id, status, amount, supplier_id, order_id,
        orders!inner(status, umkm_id)
      `,
      )
      .eq("id", escrowId)
      .single();

    if (escrowError || !escrow) {
      return Response.json({ error: "Escrow not found" }, { status: 404 });
    }

    // Cek authorization
    const isAuthorized =
      userRole === "admin" ||
      (userRole === "umkm" && escrow.orders.umkm_id === session.user.id);

    if (!isAuthorized) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Cek status
    if (escrow.status !== "held") {
      return Response.json(
        { error: `Escrow already ${escrow.status}` },
        { status: 400 },
      );
    }

    if (escrow.orders.status !== "delivered") {
      return Response.json(
        { error: "Order must be delivered before release" },
        { status: 400 },
      );
    }

    // ──[3] EXECUTE RELEASE (Atomic DB Transaction)────────
    const { data: result, error: releaseError } = await supabase.rpc(
      "release_escrow",
      {
        p_escrow_id: escrowId,
        p_released_by: session.user.id,
        p_released_by_role: userRole,
      },
    );

    if (releaseError) throw releaseError;

    // ──[4] LAZY: Background Jobs──────────────────────────
    // Notifikasi ke supplier
    await enqueueTask("/api/jobs/send-whatsapp", {
      to: escrow.supplier_phone,
      template: "escrow_released",
      variables: {
        amount: escrow.amount,
        orderId: escrow.order_id,
      },
    });

    // Generate invoice
    await enqueueTask("/api/jobs/generate-invoice", {
      escrowId,
    });

    // Update analytics
    await enqueueTask("/api/jobs/update-metrics", {
      event: "escrow_released",
      amount: escrow.amount,
      supplierId: escrow.supplier_id,
    });

    return Response.json(
      {
        success: true,
        escrowId,
        releasedAmount: escrow.amount,
        message: "Dana escrow berhasil dicairkan ke supplier.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Escrow release failed:", error);
    return Response.json(
      { error: "Failed to release escrow" },
      { status: 500 },
    );
  } finally {
    await releaseLock(`escrow_release:${escrowId}`, lockToken);
  }
}
```

---

## Ringkasan Perlindungan Race Condition

| Endpoint                              | Resource Lock              | TTL | Lazy Evaluation             | Skenario Dicegah                           |
| ------------------------------------- | -------------------------- | --- | --------------------------- | ------------------------------------------ |
| `POST /api/catalog/:id/lock`          | `lock:product:{id}`        | 30s | Retry via QStash (delay 5s) | Dua UMKM lock produk sama bersamaan        |
| `GET /api/cron/expire-locks`          | `lock:expire_lock:{id}`    | 10s | Skip jika busy              | Cron vs user payment di detik terakhir     |
| `POST /api/escrow/:id/release`        | `lock:escrow_release:{id}` | 60s | —                           | Double-click release, admin+user bersamaan |
| `POST /api/orders/:id/ship`           | `lock:order_ship:{id}`     | 30s | —                           | Supplier update resi 2x                    |
| `POST /api/payments/midtrans/webhook` | `lock:payment:{order_id}`  | 60s | Idempotent processing       | Webhook Midtrans duplicate delivery        |

---

## Database Functions (PostgreSQL / Supabase RPC)

### `create_price_lock()` — Atomic Lock Creation

```sql
CREATE OR REPLACE FUNCTION create_price_lock(
  p_product_id UUID,
  p_umkm_id UUID,
  p_supplier_id UUID,
  p_quantity INTEGER,
  p_unit_price DECIMAL,
  p_total_amount DECIMAL,
  p_lock_expires_at TIMESTAMPTZ
)
RETURNS TABLE(id UUID, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
DECLARE
  v_available_stock INTEGER;
  v_wallet_balance DECIMAL;
  v_lock_id UUID;
BEGIN
  -- Start transaction with serializable isolation
  SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

  -- Check stock (with FOR UPDATE to lock row)
  SELECT virtual_stock INTO v_available_stock
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF v_available_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock';
  END IF;

  -- Check wallet balance (with FOR UPDATE)
  SELECT balance INTO v_wallet_balance
  FROM umkm_wallets
  WHERE umkm_id = p_umkm_id
  FOR UPDATE;

  IF v_wallet_balance < p_total_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Deduct stock
  UPDATE products
  SET virtual_stock = virtual_stock - p_quantity
  WHERE id = p_product_id;

  -- Deduct wallet balance
  UPDATE umkm_wallets
  SET balance = balance - p_total_amount,
      locked_balance = locked_balance + p_total_amount
  WHERE umkm_id = p_umkm_id;

  -- Create lock record
  INSERT INTO price_locks (
    product_id, umkm_id, supplier_id,
    quantity, unit_price, total_amount,
    lock_expires_at, status
  ) VALUES (
    p_product_id, p_umkm_id, p_supplier_id,
    p_quantity, p_unit_price, p_total_amount,
    p_lock_expires_at, 'active'
  )
  RETURNING price_locks.id, price_locks.created_at
  INTO v_lock_id;

  RETURN QUERY SELECT v_lock_id, NOW();
END;
$$;
```

### `expire_price_lock()` — Atomic Expire & Refund

```sql
CREATE OR REPLACE FUNCTION expire_price_lock(p_lock_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

  -- Get lock details
  DECLARE
    v_lock RECORD;
  BEGIN
    SELECT * INTO v_lock
    FROM price_locks
    WHERE id = p_lock_id AND status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Lock not found or already processed';
    END IF;

    -- Restore stock
    UPDATE products
    SET virtual_stock = virtual_stock + v_lock.quantity
    WHERE id = v_lock.product_id;

    -- Refund balance
    UPDATE umkm_wallets
    SET balance = balance + v_lock.total_amount,
        locked_balance = locked_balance - v_lock.total_amount
    WHERE umkm_id = v_lock.umkm_id;

    -- Update lock status
    UPDATE price_locks
    SET status = 'expired',
        expired_at = NOW()
    WHERE id = p_lock_id;
  END;
END;
$$;
```

### `release_escrow()` — Atomic Fund Release

```sql
CREATE OR REPLACE FUNCTION release_escrow(
  p_escrow_id UUID,
  p_released_by UUID,
  p_released_by_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

  DECLARE
    v_escrow RECORD;
  BEGIN
    SELECT * INTO v_escrow
    FROM escrows
    WHERE id = p_escrow_id AND status = 'held'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Escrow not found or already released';
    END IF;

    -- Transfer to supplier wallet
    UPDATE supplier_wallets
    SET balance = balance + v_escrow.amount,
        total_earned = total_earned + v_escrow.amount
    WHERE supplier_id = v_escrow.supplier_id;

    -- Update escrow status
    UPDATE escrows
    SET status = 'released',
        released_at = NOW(),
        released_by = p_released_by,
        released_by_role = p_released_by_role
    WHERE id = p_escrow_id;

    -- Update order status
    UPDATE orders
    SET status = 'completed',
        completed_at = NOW()
    WHERE id = v_escrow.order_id;
  END;
END;
$$;
```

---

## Vercel Cron Configuration

Tambahkan ke `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/expire-locks",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/expire-payments",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/cron/release-escrow",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

---

## Response Standard

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-08-04T15:30:00Z",
    "requestId": "req_abc123"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Stok tidak mencukupi untuk quantity yang diminta",
    "details": {
      "requested": 100,
      "available": 50
    }
  },
  "meta": {
    "timestamp": "2026-08-04T15:30:00Z",
    "requestId": "req_abc123"
  }
}
```

### Rate Limit Response (429)

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Terlalu banyak request. Mohon tunggu.",
    "retryAfter": 45
  }
}
```

### Distributed Lock Response (423)

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_LOCKED",
    "message": "Resource sedang diproses. Mohon tunggu beberapa saat."
  }
}
```

---

## Testing Race Condition

Gunakan script berikut untuk load test endpoint lock:

```bash
# Install k6
# brew install k6

# File: load-test-lock.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '10s', target: 50 },  // 50 concurrent users
  ],
};

export default function () {
  const url = 'https://your-app.vercel.app/api/catalog/PRODUCT_ID/lock';
  const payload = JSON.stringify({
    quantity: 1,
    lockDurationHours: 24,
  });

  const res = http.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_TEST_TOKEN',
    },
  });

  check(res, {
    'status is 200 or 202': (r) => r.status === 200 || r.status === 202,
    'no 500 errors': (r) => r.status !== 500,
  });
}
```

```bash
k6 run load-test-lock.js
```

**Ekspektasi hasil:**

- Hanya 1 request yang mendapat status 200 (lock berhasil).
- Request lainnya mendapat status 202 (queued) atau 429 (rate limit).
- Tidak ada data inconsistency (stok negatif, saldo negatif, lock duplikat).
