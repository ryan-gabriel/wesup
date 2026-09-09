// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import OrderCenterClient from "@/components/orders/OrderCenterClient";
import { renderComponent as render } from "./test-utils";

function renderOrderCenter(viewerRole: "umkm" | "supplier" | "admin") {
  return render(<OrderCenterClient viewerRole={viewerRole} />);
}

describe("OrderCenterClient", () => {
  describe("per-role filtering", () => {
    it("shows only buyer orders to a UMKM viewer", () => {
      renderOrderCenter("umkm");
      expect(screen.getAllByText("PT Agri Sejahtera").length).toBeGreaterThan(0);
      expect(screen.queryAllByText("Toko Sembako Jaya")).toHaveLength(0);
    });

    it("shows buyer-only payment CTA to a UMKM viewer", () => {
      renderOrderCenter("umkm");
      const payLinks = screen.getAllByRole("link", { name: /bayar sekarang/i });
      expect(payLinks).toHaveLength(4);
      expect(payLinks.map((l) => l.getAttribute("href"))).toContain("/pesanan/ord-umkm-002/bayar");
      expect(screen.getAllByRole("link", { name: /jadwal bayar/i }).length).toBeGreaterThan(0);
    });

    it("shows only supplier orders to a supplier viewer", () => {
      renderOrderCenter("supplier");
      expect(screen.getAllByText("Toko Sembako Jaya").length).toBeGreaterThan(0);
      expect(screen.queryAllByText("PT Agri Sejahtera")).toHaveLength(0);
    });

    it("hides payment CTA for a supplier viewer", () => {
      renderOrderCenter("supplier");
      expect(screen.queryAllByRole("link", { name: /bayar sekarang/i })).toHaveLength(0);
      expect(screen.queryAllByRole("link", { name: /jadwal bayar/i })).toHaveLength(0);
    });

    it("points a supplier viewer to the batch pickup scanner", () => {
      renderOrderCenter("supplier");
      const pickupLinks = screen.getAllByRole("link", { name: /serah terima/i });
      expect(pickupLinks.length).toBeGreaterThan(0);
      pickupLinks.forEach((link) => {
        expect(link.getAttribute("href")).toContain("/supplier/batch/batch-active-001/pickup");
      });
    });

    it("hides the role badge in a single-role view", () => {
      renderOrderCenter("umkm");
      expect(screen.queryAllByText("Supplier")).toHaveLength(0);
      expect(screen.queryAllByText("Buyer")).toHaveLength(0);
    });

    it("shows every order to an admin viewer with role tags", () => {
      renderOrderCenter("admin");
      expect(screen.getAllByText("PT Agri Sejahtera").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Toko Sembako Jaya").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Buyer").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Supplier").length).toBeGreaterThan(0);
    });
  });

  describe("summary", () => {
    it("counts only the filtered orders for a UMKM viewer", () => {
      renderOrderCenter("umkm");
      expect(screen.getByText("Total Pesanan")).toBeInTheDocument();
      expect(screen.getAllByText("11").length).toBeGreaterThan(0);
      expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    });
  });
});