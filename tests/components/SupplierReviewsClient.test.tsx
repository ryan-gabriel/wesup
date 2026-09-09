// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import SupplierReviewsClient from "@/components/supplier/reputation/SupplierReviewsClient";
import { getSupplierRatings } from "@/lib/supplier-ratings/mock-data";
import { renderComponent as render } from "./test-utils";

const RATINGS = getSupplierRatings("Koperasi Pangan Bandung")!;

describe("SupplierReviewsClient (PRD 2.2.6)", () => {
  it("renders the supplier name and overall average", () => {
    render(<SupplierReviewsClient ratings={RATINGS} />);
    expect(screen.getByText(/penilaian & ulasan/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /koperasi pangan bandung/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/4,0/i)).toBeInTheDocument();
  });

  it("reports total rating count", () => {
    render(<SupplierReviewsClient ratings={RATINGS} />);
    expect(screen.getByText(/25 ulasan/i)).toBeInTheDocument();
  });

  it("renders five distribution bars matching the fixture", () => {
    render(<SupplierReviewsClient ratings={RATINGS} />);
    expect(
      screen.getByRole("group", { name: /rincian per bintang/i }),
    ).toBeInTheDocument();
    for (const score of [1, 2, 3, 4, 5]) {
      expect(
        screen.getByRole("listitem", { name: new RegExp(`${score} bintang`) }),
      ).toBeInTheDocument();
    }
  });

  it("renders recent review notes with buyer names and comments", () => {
    render(<SupplierReviewsClient ratings={RATINGS} />);
    expect(screen.getByText(/warung berkah/i)).toBeInTheDocument();
    expect(
      screen.getByText(/beras belanjaan selaras dengan spesifikasi/i),
    ).toBeInTheDocument();
  });
});