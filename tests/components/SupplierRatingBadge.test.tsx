// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import SupplierRatingBadge from "@/components/marketplace/SupplierRatingBadge";
import { renderComponent as render } from "./test-utils";

describe("SupplierRatingBadge (PRD 2.2.6)", () => {
  it("renders average and total when a rating exists", () => {
    render(<SupplierRatingBadge rating={{ average: 4.04, total: 25 }} />);
    expect(screen.getByText(/4,0/i)).toBeInTheDocument();
    expect(screen.getByText(/25 ulasan/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/rating 4,0 dari 5/i),
    ).toBeInTheDocument();
  });

  it("shows an empty state instead of values when there is no rating yet", () => {
    render(<SupplierRatingBadge rating={null} />);
    expect(screen.getByText(/belum ada penilaian/i)).toBeInTheDocument();
    expect(screen.queryByText(/4,0/i)).not.toBeInTheDocument();
  });
});