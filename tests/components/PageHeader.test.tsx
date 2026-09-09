// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { renderComponent as render } from "./test-utils";

describe("PageHeader", () => {
  it("renders the title as a single top-level heading", () => {
    render(<PageHeader title="Pesanan" description="Kelola pesanan Anda di Wesup." icon={<ShoppingBag aria-hidden="true" />} />);
    const heading = screen.getByRole("heading", { level: 1, name: "Pesanan" });
    expect(heading).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Pesanan" }),
    ).toBeInTheDocument();
  });

  it("renders the description paragraph when provided", () => {
    render(<PageHeader title="Pesanan" description="Kelola pesanan Anda di Wesup." />);
    expect(screen.getByText("Kelola pesanan Anda di Wesup.")).toBeInTheDocument();
  });

  it("omits the description entirely when not provided", () => {
    render(<PageHeader title="Pesanan" />);
    expect(screen.queryByText("Kelola pesanan Anda di Wesup.")).not.toBeInTheDocument();
  });

  it("renders the icon as decorative content hidden from assistive tech", () => {
    render(<PageHeader title="Pesanan" icon={<ShoppingBag aria-hidden="true" />} />);
    expect(screen.getByRole("heading", { level: 1, name: "Pesanan" })).toBeInTheDocument();
    const iconBox = screen.getByRole("heading", { level: 1 }).querySelector("span[aria-hidden='true']");
    expect(iconBox).not.toBeNull();
  });
});