import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("supplier batch real-data wiring", () => {
  it("does not retain the production supplier batch mock modules", () => {
    expect(existsSync(join(root, "lib/supplier-batch/mock-data.ts"))).toBe(false);
    expect(existsSync(join(root, "lib/supplier-batch/mock-repository.ts"))).toBe(false);
  });

  it("keeps dashboard and pickup consumers on real repositories", () => {
    const dashboard = readFileSync(join(root, "components/supplier/dashboard/SupplierDashboard.tsx"), "utf8");
    const pickup = readFileSync(join(root, "components/supplier/fulfillment/PickupScannerClient.tsx"), "utf8");
    expect(dashboard).not.toContain("supplier-batch/mock");
    expect(dashboard).toContain("supplierDashboardRepository");
    expect(pickup).not.toContain("supplierBatchMockRepository");
    expect(pickup).toContain("supplierBatchApiRepository");
  });
});
