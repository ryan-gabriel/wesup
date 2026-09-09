// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RatingFormClient from "@/components/ratings/RatingFormClient";
import { ACCOUNT_ORDER_MOCKS } from "@/lib/orders/mock-data";
import { getRatingScenarioForOrder } from "@/lib/ratings/mock-data";
import type { AccountOrder } from "@/lib/orders/types";
import type { RatingScenario } from "@/lib/ratings/types";
import { renderComponent as render } from "./test-utils";

function orderFor(orderId: string): AccountOrder {
  const order = ACCOUNT_ORDER_MOCKS.find((candidate) => candidate.id === orderId);
  if (!order) throw new Error(`order mock not found: ${orderId}`);
  return order;
}

function scenarioFor(orderId: string): RatingScenario {
  return getRatingScenarioForOrder(orderId);
}

describe("RatingFormClient (PRD 2.2.6)", () => {
  it("renders the star rating form only after pickup is complete (unlocked)", () => {
    render(
      <RatingFormClient
        order={orderFor("ord-umkm-003")}
        scenario={scenarioFor("ord-umkm-003")}
      />,
    );
    expect(
      screen.getByRole("group", { name: /berikan rating/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /5 bintang/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /kirim penilaian/i }),
    ).toBeInTheDocument();
  });

  it("rejects submission before a star is chosen", async () => {
    const user = userEvent.setup();
    render(
      <RatingFormClient
        order={orderFor("ord-umkm-003")}
        scenario={scenarioFor("ord-umkm-003")}
      />,
    );
    await user.click(screen.getByRole("button", { name: /kirim penilaian/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/pilih rating/i);
  });

  it("selects a star, then submits and shows the success panel", async () => {
    const user = userEvent.setup();
    render(
      <RatingFormClient
        order={orderFor("ord-umkm-003")}
        scenario={scenarioFor("ord-umkm-003")}
      />,
    );
    const star = screen.getByRole("button", { name: /5 bintang/i });
    await user.click(star);
    expect(star).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /kirim penilaian/i }));
    expect(screen.getByText(/penilaian berhasil dikirim/i)).toBeInTheDocument();
  });

  it("blocks the form for no_show transactions (Validasi Input)", () => {
    render(
      <RatingFormClient
        order={orderFor("ord-umkm-005")}
        scenario={scenarioFor("ord-umkm-005")}
      />,
    );
    expect(
      screen.queryByRole("group", { name: /berikan rating/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /rating diblokir/i }),
    ).toBeInTheDocument();
  });

  it("shows the existing rating instead of the form when already rated", () => {
    render(
      <RatingFormClient
        order={orderFor("ord-umkm-008")}
        scenario={scenarioFor("ord-umkm-008")}
      />,
    );
    expect(
      screen.getByText(/penilaian anda sudah tercatat/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /kirim penilaian/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps the form hidden before serah-terima is complete (locked_pre_pickup)", () => {
    render(
      <RatingFormClient
        order={orderFor("ord-umkm-001")}
        scenario={scenarioFor("ord-umkm-001")}
      />,
    );
    expect(
      screen.queryByRole("group", { name: /berikan rating/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/serah terima/i)).toBeInTheDocument();
  });
});