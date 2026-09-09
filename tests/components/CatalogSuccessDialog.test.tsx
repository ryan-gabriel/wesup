// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderComponent as render } from "./test-utils";
import CatalogSuccessDialog, { successKindFor } from "@/components/supplier/catalog/CatalogSuccessDialog";

describe("CatalogSuccessDialog", () => {
  it.each([
    ["draft", "Draft berhasil disimpan", "Katalog Anda tersimpan sebagai draft"],
    ["published", "Penawaran berhasil diterbitkan", "Katalog Anda sekarang tayang di marketplace"],
    ["updated", "Perubahan berhasil disimpan", "Perubahan pada katalog Anda sudah tersimpan"],
  ] as const)("shows the correct copy for %s", (kind, title, description) => {
    render(<CatalogSuccessDialog open kind={kind} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toHaveAccessibleName(title);
    expect(screen.getByText(new RegExp(description))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lihat Katalog Saya" })).toBeInTheDocument();
  });

  it("closes from the X button, primary action, Escape, and backdrop", () => {
    const onClose = vi.fn();
    const { rerender } = render(<CatalogSuccessDialog open kind="published" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Tutup dialog" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<CatalogSuccessDialog open kind="published" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Lihat Katalog Saya" }));
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(<CatalogSuccessDialog open kind="published" onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);

    rerender(<CatalogSuccessDialog open kind="published" onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.mouseDown(dialog.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it("traps forward and backward Tab focus inside the dialog", async () => {
    render(<CatalogSuccessDialog open kind="published" onClose={vi.fn()} />);
    const closeButton = screen.getByRole("button", { name: "Tutup dialog" });
    const primaryButton = screen.getByRole("button", { name: "Lihat Katalog Saya" });

    await waitFor(() => expect(closeButton).toHaveFocus());
    primaryButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    closeButton.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(primaryButton).toHaveFocus();
  });

  it("focuses the close control when opened", async () => {
    render(<CatalogSuccessDialog open kind="draft" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Tutup dialog" })).toHaveFocus());
  });

  it("maps the actual mutation action to the right success state", () => {
    expect(successKindFor("draft")).toBe("draft");
    expect(successKindFor("publish")).toBe("published");
    expect(successKindFor("draft", "batch-1")).toBe("updated");
  });
});
