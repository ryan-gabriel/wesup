import { test, expect } from "@playwright/test";

/*
 * End-to-end flows for Wesup's supplier area.
 *
 * Scope note: supplier dashboard pages run on mock data and are now guarded by
 * app/supplier/(dashboard)/layout.tsx via requireRole(["supplier"]). Traversing
 * the *authenticated* mock dashboard requires a real Supabase session, which is
 * out of scope while pages are mock-driven (per the "flow & navigation first,
 * no DB wiring" decision). These tests therefore cover:
 *  1. The public navigation flow (nav links resolve — no 404) to /pesanan,
 *     /notifikasi, /akun, /marketplace, /login.
 *  2. Public supplier registration ( /supplier/register ).
 *  3. The security guard: unauthenticated visits to guarded /supplier/* pages
 *     redirect to /login instead of leaking the dashboard.
 */

const NAV_TARGETS: { path: string; heading: RegExp }[] = [
  { path: "/pesanan", heading: /Pesanan/ },
  { path: "/notifikasi", heading: /Notifikasi/ },
  { path: "/akun", heading: /Akun/ },
];

test.describe("public navigation flow", () => {
  test("home landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).not.toContainText("404");
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("nav targets referenced by top navigation load with working nav", async ({ page }) => {
    for (const { path, heading } of NAV_TARGETS) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
      await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeVisible();
      await expect(page.locator("body")).not.toContainText("404");
    }
  });

  test("marketplace and login pages render", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(page.locator("body")).not.toContainText("404");
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Masuk/i);
  });
});

test.describe("public supplier registration", () => {
  test("public registration page loads and is reachable without auth", async ({ page }) => {
    await page.goto("/supplier/register");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Pendaftaran Pemasok/i);
    await expect(page.locator("body")).not.toContainText("404");
  });
});

test.describe("supplier dashboard guard", () => {
  const guardedPaths = [
    "/supplier",
    "/supplier/catalog",
    "/supplier/catalog/new",
    "/supplier/recurring",
    "/supplier/batch/batch-active-001",
    "/supplier/akun/escrow",
    "/supplier/akun/laporan",
  ];

  for (const path of guardedPaths) {
    test(`${path} redirects unauthenticated users to /login`, async ({ page }) => {
      await page.goto(path);
      await page.waitForURL(/\/login/, { timeout: 15_000 });
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/Masuk/i);
    });
  }
});
