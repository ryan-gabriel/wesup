// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import TierProgressBar from "@/components/marketplace/TierProgressBar";
import { renderComponent as render } from "./test-utils";

const TIERS = [
  { tierNumber: 1, minVolume: 1, maxVolume: 49, pricePerUnit: 25000 },
  { tierNumber: 2, minVolume: 50, maxVolume: 99, pricePerUnit: 22000 },
];

describe("TierProgressBar", () => {
  it("shows quantity, active price, next tier target, and accessible progress", () => {
    render(
      <TierProgressBar
        registeredQuantity={30}
        tiers={TIERS}
        tierProgress={{
          currentTierNumber: 1,
          currentPricePerUnit: 25000,
          nextTierNumber: 2,
          nextTierMinVolume: 50,
          remainingToNextTier: 20,
          progressPercent: 60,
        }}
      />,
    );

    expect(screen.getByText("30 unit terkumpul")).toBeInTheDocument();
    expect(screen.getByText(/Rp\s*25\.000/)).toBeInTheDocument();
    expect(screen.getByText("20 unit lagi menuju Tier 2")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemin", "0");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "100");
  });

  it("announces when the final tier has been reached", () => {
    render(
      <TierProgressBar
        registeredQuantity={120}
        tiers={TIERS}
        tierProgress={{
          currentTierNumber: 2,
          currentPricePerUnit: 22000,
          nextTierNumber: null,
          nextTierMinVolume: null,
          remainingToNextTier: 0,
          progressPercent: 100,
        }}
      />,
    );
    expect(screen.getByText("Tier terbaik tercapai")).toBeInTheDocument();
  });
});
