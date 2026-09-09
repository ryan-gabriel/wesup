// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LandingFaq } from "@/components/landing/Faq";
import { renderComponent as render } from "./test-utils";

const QUESTIONS = [
  "Apakah Wesup melayani di luar Bandung?",
  "Bagaimana cara kerja diskon tier?",
  "Bagaimana saya tahu supplier terpercaya?",
  "Apa yang terjadi jika barang rusak atau tidak sesuai?",
  "Bagaimana jika saya terlambat mengambil barang?",
  "Apakah ada biaya pengiriman atau ongkos kirim?",
];

describe("LandingFaq", () => {
  it("renders the section heading and every question", () => {
    render(<LandingFaq />);
    expect(
      screen.getByRole("heading", { name: /pertanyaan yang sering diajukan/i }),
    ).toBeInTheDocument();
    for (const question of QUESTIONS) {
      expect(screen.getByText(question)).toBeInTheDocument();
    }
  });

  it("starts with every answer collapsed and hidden", () => {
    render(<LandingFaq />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(QUESTIONS.length);
    for (const button of buttons) {
      expect(button.getAttribute("aria-expanded")).toBe("false");
    }
    for (const region of screen.getAllByRole("region", { hidden: true })) {
      expect(region).toHaveAttribute("hidden");
    }
  });

  it("expands the clicked item and collapses it on a second click", async () => {
    const user = userEvent.setup();
    render(<LandingFaq />);

    const button = screen.getByRole("button", { name: QUESTIONS[0] });
    const region = document.getElementById(
      button.getAttribute("aria-controls") as string,
    ) as HTMLElement;

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(region).toHaveAttribute("hidden");

    await user.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(region).not.toHaveAttribute("hidden");
    expect(region).toBeVisible();

    await user.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(region).toHaveAttribute("hidden");
  });

  it("links every button to its content via aria-controls", () => {
    render(<LandingFaq />);
    for (const button of screen.getAllByRole("button")) {
      const controls = button.getAttribute("aria-controls");
      expect(controls).toBeTruthy();
      expect(document.getElementById(controls as string)).not.toBeNull();
    }
  });
});