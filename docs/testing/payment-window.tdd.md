# TDD Evidence Report — Payment Window (PRD 2.2.3)

## Source plan
Rencana disusun dari analisis fitur **2.2.3 Pembayaran Tagihan (Payment Window)** pada `prd/PRD.md`. PRD mensyaratkan: tagihan final sesuai tier terkunci; UI Countdown berbasis Server Timestamp; integrasi QRIS/Midtrans; UI Feedback Global Error Handling; validasi Gatekeeper (tombol diblokir di luar window); serta sanksi Hit & Run berjenjang.

Audit menemukan celah: **tidak ada halaman/komponen Payment Window sama sekali**. Order `pending_payment` hanya tampil sebagai baris di `app/pesanan` tanpa aksi bayar; tidak ada state gate waiting/open/expired; dan `lib/orders/time-gatekeeper.ts` hanya punya `evaluateRegistrationWindow`, tanpa evaluasi jendela pembayaran. Perubahan ini menutup celah tersebut agar 2.2.3 selaras dengan PRD, sebagai basis UI statis (mock-driven) bagi role pemoles berikutnya.

## User journeys
- Sebagai UMKM, saya melihat **tagihan final** (tier diskon terkunci, harga/unit, qty, total, referensi) setelah pendaftaran ditutup.
- Sebagai UMKM, saya melihat **countdown berbasis Server Timestamp** menuju pembukaan Payment Window; begitu window aktif, countdown menuju batas akhir.
- Sebagai UMKM, saya hanya dapat menekan **"Bayar via QRIS"** di dalam Payment Window — tombol terkunci (disabled) sebelum buka, setelah lewat, atau bila sudah lunas.
- Sebagai UMKM yang **melewatkan** window, saya melihat peringatan sanksi Hit & Run berjenjang (Peringatan → Suspend 7 hari → Suspend permanen).

## Task report
Eksekusi mengikuti alur TDD (RED → GREEN → refactor) pada **helper logika murni** terlebih dahulu, lalu penambahan **test komponen** (jsdom + RTL, `tests/components/`) untuk memverifikasi state UI.

### Task: helper `evaluatePaymentWindow`
- **Ringkasan:** Gate murni berbasis waktu; blok pembayaran di luar rentang `[payment_opens_at, payment_closes_at)`.
- **File produksi:** `lib/orders/time-gatekeeper.ts`
- **File test:** `tests/unit/time-gatekeeper.test.ts`
- **Validation command:** `npm test -- tests/unit/time-gatekeeper.test.ts`

**RED — output awal (fungsi belum ada):**
```
FAIL  tests/unit/time-gatekeeper.test.ts
Error: evaluatePaymentWindow is not exported from '@/lib/orders/time-gatekeeper'
```

**GREEN — setelah fungsi dibuat:**
```
Test Files  1 passed (1)
     Tests  16 passed (16)
```

### Task: basis UI statis Payment Window
- `lib/payments/types.ts` — `PaymentInvoice`, `PaymentResolution` (open/waiting/expired/paid), `StrikeLevel`.
- `lib/payments/mock-data.ts` — 4 invoice mock menutupi seluruh state gate + `getPaymentInvoiceMock(orderId)`.
- `components/payments/PaymentCountdown.tsx` — countdown di-anchor ke `serverNowIso` (mock Server Timestamp); perangkat klien hanya menyediakan delta relatif; `role="timer"` + label "Waktu server".
- `components/payments/PaymentInvoiceCard.tsx`, `components/payments/QrisPaymentMock.tsx`, `components/payments/HitAndRunBanner.tsx`.
- `components/payments/PaymentWindowClient.tsx` — orkestrator state gate (memakai `evaluatePaymentWindow` dari mock server timestamp); tombol QrIS statis tanpa handler.
- `app/pesanan/[orderId]/bayar/page.tsx` — halaman statis + `notFound()` bila orderId tak dikenal.
- `components/orders/OrderCenterClient.tsx` — aksi "Bayar Sekarang"/"Jadwal Bayar" untuk pending_payment/registered, catatan "Menunggu jendela pembayaran dibuka" (prasyarat 2.2.4), plus 2 order mock baru di `lib/orders/mock-data.ts`.

### Task: test komponen UI
- `tests/components/PaymentCountdown.test.tsx` (3 tes) — remain HH:MM:SS dari server timestamp; role timer; clamp saat deadline lewat.
- `tests/components/PaymentWindowClient.test.tsx` (5 tes) — gate open (tombol enabled + countdown), waiting (tombol disabled), expired (banner sanksi + tombol disabled), paid (label lunas, tanpa countdown), dan ringkasan tagihan tier terkunci selalu tampil.

**GREEN (keseluruhan suite terkait):**
```
Test Files  3 passed (3)
     Tests  24 passed (24)
```

## Test specification

| # | Yang dijamin | Test file | Test type | Hasil | Evidence |
|---|--------------|-----------|-----------|-------|----------|
| 1 | Pembayaran diblokir sebelum window buka (`not_open`/waiting) | `tests/unit/time-gatekeeper.test.ts` | unit | PASS | `npm test -- tests/unit/time-gatekeeper.test.ts` |
| 2 | Pembayaran diizinkan di dalam window (inklusi batas buka) | `tests/unit/time-gatekeeper.test.ts` | unit | PASS | idem |
| 3 | Pembayaran diblokir saat/setelah batas akhir (`expired`) | `tests/unit/time-gatekeeper.test.ts` | unit | PASS | idem |
| 4 | Countdown menampilkan nilai awal dari server timestamp | `tests/components/PaymentCountdown.test.tsx` | component | PASS | `npx vitest run tests/components/PaymentCountdown.test.tsx` |
| 5 | Countdown clamp ke nol bila deadline terlewat | `tests/components/PaymentCountdown.test.tsx` | component | PASS | idem |
| 6 | Gate `open` → tombol QRIS enabled + countdown batas akhir | `tests/components/PaymentWindowClient.test.tsx` | component | PASS | `npx vitest run tests/components/PaymentWindowClient.test.tsx` |
| 7 | Gate `waiting` → tombol terkunci | `tests/components/PaymentWindowClient.test.tsx` | component | PASS | idem |
| 8 | Gate `expired` → banner sanksi Hit & Run (role=alert) + tombol terkunci | `tests/components/PaymentWindowClient.test.tsx` | component | PASS | idem |
| 9 | Gate `paid` → label lunas, tanpa countdown | `tests/components/PaymentWindowClient.test.tsx` | component | PASS | idem |
| 10 | Tagihan final (tier terkunci, total) selalu dirender | `tests/components/PaymentWindowClient.test.tsx` | component | PASS | idem |

## Coverage dan gap yang diketahui
- Test penuh: **828 passed / 829** (`npm test`); satu kegagalan pre-existing di `tests/live/database.integration.test.ts` (drift enum `audit_action` pada live DB vs contract) — **tidak terkait** perubahan ini (tidak ada perubahan migration/schema).
- `npm run lint`: **0 errors** (warning pre-existing hanya di file lain).
- `npm run build`: sukses; route baru `/pesanan/[orderId]/bayar` terdaftar sebagai dinamis.
- Karena basis ini statis (mock), perilaku **webhook → status lunas**, refresh QRIS asli, dan timeout realtime countdown belum di-cover — akan ditangani role pemoles berikutnya (integrasi `payments`/`payment_webhook_logs` + Midtrans).

## Merge evidence
RED/GREEN pada helper dan komponen dicatat di atas. Tidak ada squash pada cabang tugas ini.