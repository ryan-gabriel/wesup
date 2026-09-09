// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import PaymentCountdown from "@/components/payments/PaymentCountdown";
import { renderComponent as render } from "./test-utils";

describe("PaymentCountdown", () => {
  it("renders remaining HH:MM:SS derived from the server timestamp", () => {
    render(
      <PaymentCountdown
        serverNowIso="2026-08-28T08:00:00.000Z"
        deadlineIso="2026-08-28T10:00:00.000Z"
        tone="info"
      />,
    );
    expect(screen.getByText("02:00:00")).toBeInTheDocument();
  });

  it("exposes a timer role with a server-time label", () => {
    render(
      <PaymentCountdown
        serverNowIso="2026-08-28T08:00:00.000Z"
        deadlineIso="2026-08-28T10:00:00.000Z"
        tone="info"
      />,
    );
    expect(screen.getByRole("timer")).toBeInTheDocument();
    expect(screen.getByText("Waktu server")).toBeInTheDocument();
  });

  it("clamps to all-zero when the deadline already passed (server time)", () => {
    render(
      <PaymentCountdown
        serverNowIso="2026-08-29T09:00:00.000Z"
        deadlineIso="2026-08-29T08:00:00.000Z"
        tone="danger"
      />,
    );
    expect(screen.getByText("00:00:00")).toBeInTheDocument();
  });
});