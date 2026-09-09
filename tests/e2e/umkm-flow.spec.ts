import { test, expect, type Page } from "@playwright/test";

/*
 * End-to-end traversal alur UMKM (buyer) — dari landing page masuk ke
 * seluruh fitur, mengikuti klik nyata user (bukan sekadar navigasi URL):
 *
 *   Landing → Marketplace (browse, search, filter, paginasi)
 *   → Detail penawaran (peta + persetujuan lokasi + join)
 *   → Pusat Pesanan (filter status, bayar) → Payment Window (QRIS)
 *   → Serah Terima (QR + PIN) → Penilaian → Komplain → Sengketa
 *   → Refund Rekening → Akun → Notifikasi → Navigasi global.
 *
 * Halaman-halaman ini berjalan di atas mock data sehingga dapat ditraversal
 * tanpa sesi Supabase asli. Setiap halaman di-assert bebas 404.
 */

async function assertNo404(page: Page): Promise<void> {
  await expect(page.locator("body")).not.toContainText("404");
}

async function productCardLinks(page: Page) {
  const links = page.locator('a[href^="/marketplace/"]');
  await expect(links.first()).toBeVisible({ timeout: 15_000 });
  return links;
}

test.describe("Landing → Marketplace", () => {
  test("CTA 'Mulai Belanja (UMKM)' masuk ke marketplace tanpa 404", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const cta = page.getByRole("link", { name: /mulai belanja \(umkm\)/i });
    await expect(cta).toBeVisible();
    await cta.click();

    await page.waitForURL(/\/marketplace/, { timeout: 15_000 });
    await assertNo404(page);
    await expect(page.getByRole("heading", { name: /penawaran marketplace/i })).toBeVisible();
    await expect(page.locator("body")).toContainText(/penawaran ditemukan/);
  });
});

test.describe("Marketplace browse, filter & paginasi", () => {
  test("hasil default termuat (radius 10 km)", async ({ page }) => {
    await page.goto("/marketplace");
    await productCardLinks(page);
    await expect(page.locator("body")).toContainText("penawaran ditemukan");
    await expect(page.getByRole("searchbox", { name: /cari penawaran marketplace/i })).toBeVisible();
  });

  test("pencarian memfilter hasil", async ({ page }) => {
    await page.goto("/marketplace");
    await productCardLinks(page);

    const search = page.getByLabel("Cari penawaran marketplace");
    await search.fill("Sayur");

    const card = page.locator('a[href^="/marketplace/"]').first();
    await expect(card).toContainText(/sayur/i, { timeout: 10_000 });
    await expect(page.locator("body")).toContainText(/penawaran ditemukan/);
  });

  test("filter kategori + reset", async ({ page }) => {
    await page.goto("/marketplace");
    await productCardLinks(page);

    const categoryLabel = page.locator("label", { hasText: "Daging & Ikan" }).first();
    await categoryLabel.click();

    const card = page.locator('a[href^="/marketplace/"]').first();
    await expect(card).toContainText(/daging & ikan/i, { timeout: 10_000 });

    await page.getByRole("button", { name: /reset filter/i }).click();
    const results = page.getByRole("region", { name: /hasil penawaran marketplace/i });
    await expect(results).toContainText(/sayur & buah bandung/i, { timeout: 10_000 });
  });

  test("paginasi aktif setelah radius diperluas ke 50 km", async ({ page }) => {
    await page.goto("/marketplace");
    await productCardLinks(page);

    const radius = page.getByRole("slider", { name: "Radius jarak" }).first();
    await radius.focus();
    await page.keyboard.press("End");

    await expect(page.locator("body")).toContainText("30 penawaran ditemukan", { timeout: 10_000 });

    const pageTwo = page.getByRole("button", { name: "Halaman 2" });
    await expect(pageTwo).toBeVisible();
    await pageTwo.click();
    await expect(page.getByRole("button", { name: "Halaman 2" })).toHaveAttribute("aria-current", "page");

    await page.getByRole("button", { name: /prev/i }).click();
    await expect(page.getByRole("button", { name: "Halaman 1" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("Detail penawaran & join (persetujuan lokasi)", () => {
  test("dari kartu marketplace menuju detail, peta render, join membawa ke Pesanan", async ({ page }) => {
    await page.goto("/marketplace");
    const firstCard = (await productCardLinks(page)).first();
    const detailHref = await firstCard.getAttribute("href");
    expect(detailHref).toMatch(/^\/marketplace\/.+/);

    await firstCard.click();
    await page.waitForURL(/\/marketplace\/.+/);
    await assertNo404(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await expect(page.getByText("Lokasi Titik Kumpul", { exact: true })).toBeVisible();
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 15_000 });

    const consent = page.getByRole("checkbox", { name: /saya menyetujui lokasi pengambilan/i });
    await consent.click();
    await expect(consent).toHaveAttribute("aria-checked", "true");

    const daftar = page.getByRole("button", { name: /daftar sekarang/i });
    await expect(daftar).toBeEnabled();
    await daftar.click();

    await expect(page.getByText(/pendaftaran berhasil/i)).toBeVisible({ timeout: 5_000 });
    await page.waitForURL(/\/pesanan/, { timeout: 15_000 });
    await assertNo404(page);
  });

  test("tombol daftar terkunci sebelum persetujuan lokasi", async ({ page }) => {
    await page.goto("/marketplace");
    const firstCard = (await productCardLinks(page)).first();
    await firstCard.click();
    await page.waitForURL(/\/marketplace\/.+/);

    await expect(page.getByRole("button", { name: /daftar sekarang/i })).toBeDisabled();
  });
});

test.describe("Pusat Pesanan & Payment Window (QRIS)", () => {
  test("filter status pesanan bekerja", async ({ page }) => {
    await page.goto("/pesanan");
    await assertNo404(page);
    await expect(page.getByRole("heading", { level: 1, name: /pesanan/i })).toBeVisible();

    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();

    await page.getByRole("button", { name: /menunggu bayar/i }).click();
    await expect(rows).toHaveCount(2);
  });

  test("klik 'Bayar Sekarang' membuka Payment Window terbuka (open)", async ({ page }) => {
    await page.goto("/pesanan");
    const bayar = page.getByRole("link", { name: /bayar sekarang/i }).first();
    await expect(bayar).toBeVisible();
    await bayar.click();

    await page.waitForURL(/\/pesanan\/ord-umkm-002\/bayar/, { timeout: 15_000 });
    await assertNo404(page);

    await expect(page.getByRole("heading", { level: 1, name: /kentang granola segar/i })).toBeVisible();
    await expect(page.locator("body")).toContainText("Sisa waktu pembayaran");
    await expect(page.getByRole("region", { name: /pembayaran qris/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /bayar via qris/i })).toBeVisible();
  });

  test("invoice lunas (paid) menampilkan link ke kode QR pengambilan", async ({ page }) => {
    await page.goto("/pesanan/ord-umkm-001/bayar");
    await assertNo404(page);
    await expect(page.locator("body")).toContainText("Pembayaran terkonfirmasi lunas");

    const qrLink = page.getByRole("link", { name: /lihat kode qr pengambilan/i });
    await qrLink.click();
    await page.waitForURL(/\/pesanan\/ord-umkm-001\/serah-terima/, { timeout: 15_000 });
    await assertNo404(page);
  });

  test("invoice menunggu jendela menampilkan state waiting", async ({ page }) => {
    await page.goto("/pesanan/ord-umkm-006/bayar");
    await assertNo404(page);
    await expect(page.locator("body")).toContainText("Menunggu jendela pembayaran dibuka");
    await expect(page.getByRole("button", { name: /tunggu jendela pembayaran dibuka/i })).toBeDisabled();
  });

  test("invoice expired menampilkan sanksi Hit & Run", async ({ page }) => {
    await page.goto("/pesanan/ord-umkm-007/bayar");
    await assertNo404(page);
    await expect(page.locator("body")).toContainText("Jendela pembayaran ditutup");
    await expect(page.locator("body")).toContainText("Hit & Run");
  });
});

test.describe("Serah Terima (kredensial pengambilan)", () => {
  test("pesanan lunas menampilkan QR + PIN 4 digit", async ({ page }) => {
    await page.goto("/pesanan/ord-umkm-001/serah-terima");
    await assertNo404(page);

    await expect(page.getByRole("heading", { name: /kode qr pengambilan/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /pin 4 digit cadangan/i })).toBeVisible();
    await expect(page.getByText("PIN 4 digit: 4 8 2 1")).toBeVisible();
    await expect(page.locator("body")).toContainText(/jendela toleransi 12 jam/i);
  });

  test("pesanan belum lunas menampilkan 'Kredensial Belum Terbit' + CTA bayar", async ({ page }) => {
    await page.goto("/pesanan/ord-umkm-002/serah-terima");
    await assertNo404(page);

    await expect(page.getByRole("heading", { name: /kredensial belum terbit/i })).toBeVisible();
    const bayar = page.getByRole("link", { name: /bayar sekarang/i });
    await expect(bayar).toBeVisible();
    await bayar.click();
    await page.waitForURL(/\/pesanan\/ord-umkm-002\/bayar/, { timeout: 15_000 });
  });
});

test.describe("Penilaian & ulasan (PRD 2.2.6)", () => {
  test("form rating interaktif dari awal sampai terkirim", async ({ page }) => {
    await page.goto("/pesanan/ord-umkm-003/nilai");
    await assertNo404(page);

    const form = page.getByRole("form", { name: /nilai & ulas/i }).or(
      page.locator("form"),
    );
    await expect(form.first()).toBeVisible();

    const starFive = page.getByRole("button", { name: "5 bintang — Sangat baik" });
    await starFive.click();
    await expect(page.getByText("5 bintang — Sangat baik")).toBeVisible();

    await page.getByLabel(/ulasan untuk/i).fill("Barang segar dan antrean cepat.");
    await page.getByRole("button", { name: /kirim penilaian/i }).click();

    await expect(page.getByRole("heading", { name: /penilaian berhasil dikirim/i })).toBeVisible();
  });

  test("pesanan picked_up yang belum dinilai menampilkan form (unlocked)", async ({ page }) => {
    await page.goto("/pesanan/ord-umkm-003/nilai");
    await expect(page.getByRole("button", { name: /1 bintang/i })).toBeVisible();
  });
});

test.describe("Komplain, Sengketa & Refund (PRD 2.2.5)", () => {
  test("jendela komplain 1x24 jam terbuka menampilkan form", async ({ page }) => {
    await page.goto("/pesanan/ord-umkm-008/komplain");
    await assertNo404(page);

    await expect(page.locator("body")).toContainText("Ajukan komplain dalam batas 1×24 jam");
    await expect(page.getByRole("radio", { name: /barang cacat/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /barang busuk/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /ajukan komplain & bekukan dana/i })).toBeVisible();
  });

  test("sengketa under_review menampilkan escrow dibekukan", async ({ page }) => {
    await page.goto("/pesanan/ord-umkm-009/sengketa");
    await assertNo404(page);

    await expect(page.getByText("Lacak Sengketa Escrow")).toBeVisible();
    await expect(page.locator("body")).toContainText("Dana Dibekukan (Escrow Suspended)");
    await expect(page.locator("body")).toContainText("Komplain diajukan");
  });

  test("form rekening refund tampil saat refund waiting_bank_account", async ({ page }) => {
    await page.goto("/pesanan/ord-umkm-010/refund/rekening");
    await assertNo404(page);

    await expect(page.getByPlaceholder("Contoh: BRI, BCA, Mandiri")).toBeVisible();
    await expect(page.getByPlaceholder("Hanya angka")).toBeVisible();
    await expect(page.getByPlaceholder("Ulangi nomor rekening")).toBeVisible();
    await expect(page.getByPlaceholder("Nama sesuai buku rekening")).toBeVisible();
  });
});

test.describe("Akun & Notifikasi", () => {
  test("profil UMKM & toggle role supplier, link supplier digagalkan guard ke /login", async ({ page }) => {
    await page.goto("/akun");
    await assertNo404(page);

    await expect(page.locator("body")).toContainText("Rina Suryani");
    await expect(page.getByText("UMKM", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: /supplier \(pt agri\)/i }).click();
    const rekening = page.getByRole("link", { name: /rekening pencairan/i });
    await expect(rekening).toBeVisible();

    await rekening.click();
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1, name: /masuk/i })).toBeVisible();
  });

  test("logout dari halaman akun kembali ke beranda", async ({ page }) => {
    await page.goto("/akun");
    await page.getByRole("button", { name: /keluar \(logout\)/i }).click();
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await assertNo404(page);
  });

  test("notifikasi: daftar tampil dan 'Tandai semua dibaca' bekerja", async ({ page }) => {
    await page.goto("/notifikasi");
    await assertNo404(page);

    await expect(page.getByRole("heading", { level: 1, name: /notifikasi/i })).toBeVisible();
    const button = page.getByRole("button", { name: /tandai semua dibaca/i });
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.getByText("Semua sudah dibaca")).toBeVisible();
  });
});

test.describe("Navigasi global (NavigationBar)", () => {
  test("item navigasi utama mengarah ke halaman tanpa 404", async ({ page }) => {
    const navTargets: { label: string; url: RegExp }[] = [
      { label: "Beranda", url: /\/$/ },
      { label: "Marketplace", url: /\/marketplace/ },
      { label: "Notifikasi", url: /\/notifikasi/ },
      { label: "Akun", url: /\/akun/ },
    ];

    for (const target of navTargets) {
      await page.goto("/pesanan");
      const nav = page.getByRole("navigation", { name: "Navigasi utama" });
      await expect(nav).toBeVisible();

      await nav.getByRole("link", { name: new RegExp(target.label, "i") }).click();
      await page.waitForURL(target.url, { timeout: 15_000 });
      await assertNo404(page);
      await expect(page.locator("body")).not.toBeEmpty();
    }
  });

  test("navigasi ke 'Supplier' digagalkan guard ke /login saat tidak login", async ({ page }) => {
    await page.goto("/pesanan");
    await page.getByRole("navigation", { name: "Navigasi utama" })
      .getByRole("link", { name: /supplier/i })
      .click();
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1, name: /masuk/i })).toBeVisible();
  });
});