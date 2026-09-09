import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { LOGIN_REDIRECT_BY_ROLE } from "@/lib/auth/login-contract";

const APP_ROOT = join(process.cwd(), "app");
const SUPPLIER_DASHBOARD_GLOB = join(APP_ROOT, "supplier", "(dashboard)");

function globSyncRecursive(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!existsSync(full)) continue;
    if (statSync(full).isDirectory()) {
      globSyncRecursive(full, acc);
    } else if (entry === "page.tsx") {
      acc.push(full);
    }
  }
  return acc;
}

function normalizeSupplierRoute(route: string): string {
  const sansPrefix = route.replace("/supplier", "").replace(/^\//, "");
  return join(SUPPLIER_DASHBOARD_GLOB, sansPrefix, "page.tsx");
}

describe("supplier dashboard route protection", () => {
  it("guards the supplier dashboard layout with requireRole for supplier role", () => {
    const layoutPath = join(SUPPLIER_DASHBOARD_GLOB, "layout.tsx");
    expect(existsSync(layoutPath), "layout.tsx should exist").toBe(true);
    const src = readFileSync(layoutPath, "utf8");
    expect(src).toContain("requireRole");
    expect(src).toMatch(/\["supplier"\]/);
    expect(src).toContain('redirect("/login")');
  });

  it("keeps the public supplier registration page outside the guarded layout", () => {
    const registerPage = join(APP_ROOT, "supplier", "register", "page.tsx");
    expect(existsSync(registerPage)).toBe(true);
    expect(existsSync(join(SUPPLIER_DASHBOARD_GLOB, "register"))).toBe(false);
  });

  it("sends supplier logins to the supplier dashboard", () => {
    expect(LOGIN_REDIRECT_BY_ROLE.supplier).toBe("/supplier");
  });
});

describe("supplier dashboard route inventory", () => {
  const pages = globSyncRecursive(SUPPLIER_DASHBOARD_GLOB).map((p) =>
    p.split("app")[1].replaceAll("\\", "/"),
  );

  const expectedRoutes = [
    "/supplier/(dashboard)/page.tsx",
    "/supplier/(dashboard)/catalog/page.tsx",
    "/supplier/(dashboard)/catalog/new/page.tsx",
    "/supplier/(dashboard)/recurring/page.tsx",
    "/supplier/(dashboard)/recurring/new/page.tsx",
    "/supplier/(dashboard)/akun/escrow/page.tsx",
    "/supplier/(dashboard)/akun/rekening/page.tsx",
    "/supplier/(dashboard)/akun/laporan/page.tsx",
    "/supplier/(dashboard)/akun/laporan/riwayat/page.tsx",
  ];

  it("exposes all core dashboard pages (no route returns 404)", () => {
    for (const route of expectedRoutes) {
      expect(pages, `missing page file for ${route}`).toContain(route);
    }
  });
});

describe("top-level placeholder routes referenced by navigation", () => {
  it("each nav target that must not 404 has a page file", () => {
    for (const route of ["/pesanan", "/notifikasi", "/akun"]) {
      const pageFile = join(APP_ROOT, route.replace(/^\//, ""), "page.tsx");
      expect(existsSync(pageFile), `page file missing for ${route}`).toBe(true);
    }
  });
});

describe("supplier flow contract (navigation wiring)", () => {
  it("dashboard navigation links resolve to existing route files", () => {
    const navFile = join(process.cwd(), "components", "layout", "NavigationBar.tsx");
    expect(existsSync(navFile)).toBe(true);
    const src = readFileSync(navFile, "utf8");
    const hrefs = [...src.matchAll(/\bhref=\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);

    for (const href of [...new Set(hrefs)]) {
      if (!href.startsWith("/")) continue;
      const route = href.split(/[#?]/)[0];
      if (!route.startsWith("/supplier")) continue;
      expect(
        existsSync(normalizeSupplierRoute(route)),
        `dashboard link → missing route file for ${href}`,
      ).toBe(true);
    }
  });
});
