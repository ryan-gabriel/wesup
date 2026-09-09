// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MarketplaceItem } from "@/lib/marketplace/types";
import MarketplaceDetailClient from "@/components/marketplace/MarketplaceDetailClient";
import { renderComponent as render } from "./test-utils";

const DEFAULT_ITEM: MarketplaceItem = {
  id: "item-1",
  title: "Cabai Merah Premium",
  supplierName: "Mitra Tani Bandung",
  category: "Sayur & Buah",
  imageUrl: "/images/cabai.webp",
  distanceKm: 3.5,
  estimatedPickupMinutes: 25,
  basePrice: 25000,
  currentTierPrice: 22000,
  registeredQuantity: 30,
  targetQuantity: 50,
  status: "ACTIVE",
  registrationClosesAt: "2026-09-15T10:00:00.000Z",
  pickupLatitude: -6.9175,
  pickupLongitude: 107.6191,
  pickupAddress: "Jl. Asia Afrika No. 123, Bandung",
};

function makeItem(overrides: Partial<MarketplaceItem> = {}): MarketplaceItem {
  return { ...DEFAULT_ITEM, ...overrides };
}

function renderDetail(itemOverrides: Partial<MarketplaceItem> = {}, viewerRole: "umkm" | "supplier" | "admin" | null = "umkm") {
  return render(
    <MarketplaceDetailClient
      item={makeItem(itemOverrides)}
      canonicalUrl="https://wesup.id/marketplace/item-1"
      viewerRole={viewerRole}
    />,
  );
}

describe("MarketplaceDetailClient", () => {
  describe("navigation", () => {
    it("does not render its own back link (handled by the page-level breadcrumb)", () => {
      renderDetail();
      expect(screen.queryByRole("link", { name: /kembali ke marketplace/i })).not.toBeInTheDocument();
    });
  });

  describe("product information", () => {
    it("renders the product title as heading", () => {
      renderDetail();
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Cabai Merah Premium");
    });

    it("renders the supplier name", () => {
      renderDetail();
      expect(screen.getByText("Mitra Tani Bandung")).toBeInTheDocument();
    });

    it("renders the category badge", () => {
      renderDetail();
      expect(screen.getByText("Sayur & Buah")).toBeInTheDocument();
    });

    it("renders product image with descriptive alt text", () => {
      renderDetail();
      const img = screen.getByRole("img", { name: /foto produk cabai merah premium/i });
      expect(img).toBeInTheDocument();
    });
  });

  describe("location & distance", () => {
    it("shows the Titik kumpul Supplier section", () => {
      renderDetail();
      expect(screen.getByText("Titik kumpul Supplier")).toBeInTheDocument();
      expect(screen.getAllByText("Jl. Asia Afrika No. 123, Bandung").length).toBeGreaterThan(0);
    });

    it("shows absolute distance with Indonesian decimal formatting", () => {
      renderDetail();
      expect(screen.getByText("3,5 km • 25 mnt (Pickup)")).toBeInTheDocument();
    });
  });

  describe("pricing", () => {
    it("displays currentTierPrice in IDR format", () => {
      renderDetail();
      expect(screen.getByText(/Rp\s*22\.000/)).toBeInTheDocument();
    });

    it("displays basePrice with strikethrough", () => {
      renderDetail();
      const strikeEl = screen.getByText(/Rp\s*25\.000/);
      expect(strikeEl.className).toContain("line-through");
    });

    it("renders Tier Diskon label", () => {
      renderDetail();
      expect(screen.getByText("Tier Diskon")).toBeInTheDocument();
    });
  });

  describe("progress & registration", () => {
    it("shows correct progress percentage (60%)", () => {
      renderDetail();
      expect(screen.getByText("60%")).toBeInTheDocument();
    });

    it("shows target kelompok count", () => {
      renderDetail();
      expect(screen.getByText("Target Kelompok: 30/50 Porsi")).toBeInTheDocument();
    });

    it("has a progress bar with correct aria attributes", () => {
      renderDetail();
      const bar = screen.getByRole("progressbar", { name: /progres target kelompok/i });
      expect(bar).toHaveAttribute("aria-valuenow", "60");
      expect(bar).toHaveAttribute("aria-valuemin", "0");
      expect(bar).toHaveAttribute("aria-valuemax", "100");
    });
  });

  describe("call-to-action buttons", () => {
    it("renders a disabled Daftar Sekarang button", () => {
      renderDetail();
      const btn = screen.getByRole("button", { name: /daftar sekarang/i });
      expect(btn).toBeDisabled();
    });

    it("renders a WhatsApp share link with correct href", () => {
      renderDetail();
      const shareLink = screen.getByRole("link", { name: /bagikan via whatsapp/i });
      expect(shareLink).toHaveAttribute("target", "_blank");
      expect(shareLink).toHaveAttribute("rel", "noopener noreferrer");
      expect(shareLink.getAttribute("href")).toContain("https://wa.me/?text=");
    });

    it("encodes the product title into the WhatsApp message", () => {
      renderDetail();
      const shareLink = screen.getByRole("link", { name: /bagikan via whatsapp/i });
      const href = shareLink.getAttribute("href")!;
      const decoded = decodeURIComponent(href);
      expect(decoded).toContain("Cabai Merah Premium");
    });
  });

  describe("location consent", () => {
    it("shows the location consent section heading", () => {
      renderDetail();
      expect(screen.getByText("Persetujuan Lokasi Pengambilan")).toBeInTheDocument();
    });

    it("shows the consent text about self-pickup", () => {
      renderDetail();
      expect(screen.getByText(/self-pickup/i)).toBeInTheDocument();
      expect(screen.getByText(/secara mandiri/i)).toBeInTheDocument();
    });

    it("keeps Daftar button disabled until consent is given", async () => {
      const user = userEvent.setup();
      renderDetail();
      const btn = screen.getByRole("button", { name: /daftar sekarang/i });
      const checkbox = screen.getByRole("checkbox", { name: /saya menyetujui lokasi pengambilan/i });

      expect(btn).toBeDisabled();

      await user.click(checkbox);

      expect(btn).toBeEnabled();
      expect(checkbox).toHaveAttribute("aria-checked", "true");
    });

    it("shows a consent timestamp after checking the checkbox", async () => {
      const user = userEvent.setup();
      renderDetail();
      const checkbox = screen.getByRole("checkbox", { name: /saya menyetujui lokasi pengambilan/i });

      expect(screen.queryByText(/disetujui:/i)).not.toBeInTheDocument();

      await user.click(checkbox);

      expect(screen.getByText(/disetujui:/i)).toBeInTheDocument();
    });

    it("renders the pickup location map", () => {
      renderDetail();
      expect(screen.getByTestId("pickup-location-map")).toBeInTheDocument();
    });
  });

  describe("role & auth gating", () => {
    it("shows a login CTA instead of the join flow for anonymous viewers", () => {
      renderDetail({}, null);
      const loginCta = screen.getByRole("link", { name: /masuk sebagai umkm untuk mendaftar/i });
      expect(loginCta).toHaveAttribute("href", "/login");
      expect(screen.queryByRole("button", { name: /daftar sekarang/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("keeps the WhatsApp share link for anonymous viewers", () => {
      renderDetail({}, null);
      expect(screen.getByRole("link", { name: /bagikan via whatsapp/i })).toBeInTheDocument();
    });

    it("shows a buyer-only notice for supplier viewers", () => {
      renderDetail({}, "supplier");
      expect(screen.getByText(/pendaftaran hanya untuk akun umkm/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /daftar sekarang/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("shows the same buyer-only notice for admin viewers", () => {
      renderDetail({}, "admin");
      expect(screen.getByText(/pendaftaran hanya untuk akun umkm/i)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /daftar sekarang/i })).not.toBeInTheDocument();
    });

    it("hides the consent hint for non-UMKM viewers", () => {
      renderDetail({}, null);
      expect(screen.queryByText(/centang persetujuan lokasi/i)).not.toBeInTheDocument();
    });

    it("renders the join flow for UMKM viewers", () => {
      renderDetail({}, "umkm");
      expect(screen.getByRole("checkbox", { name: /saya menyetujui lokasi pengambilan/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /daftar sekarang/i })).toBeDisabled();
      expect(screen.queryByText(/pendaftaran hanya untuk akun umkm/i)).not.toBeInTheDocument();
    });
  });
});
