import { describe, expect, it } from "vitest";
import {
  getAccountStatusMessage,
  getRoleMismatchMessage,
  parseLoginPayload,
} from "@/lib/auth/login-contract";

describe("parseLoginPayload", () => {
  it("normalizes a valid login payload", () => {
    expect(
      parseLoginPayload({
        email: "  USER@Example.COM ",
        password: "password123",
        role: "supplier",
      }),
    ).toEqual({
      ok: true,
      value: {
        email: "user@example.com",
        password: "password123",
        role: "supplier",
      },
    });
  });

  it.each([
    {
      input: { email: "invalid", password: "password123", role: "umkm" },
      field: "email",
    },
    {
      input: { email: "user@example.com", password: "", role: "umkm" },
      field: "password",
    },
    {
      input: { email: "user@example.com", password: "password123", role: "owner" },
      field: "role",
    },
  ] as const)("rejects invalid $field", ({ input, field }) => {
    const result = parseLoginPayload(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors[field]).toBeTruthy();
  });
});

describe("login feedback", () => {
  it("maps inactive account statuses to Indonesian messages", () => {
    expect(getAccountStatusMessage("suspended_temporary")).toBe(
      "Akun Anda sedang ditangguhkan sementara.",
    );
    expect(getAccountStatusMessage("suspended_permanent")).toBe(
      "Akun Anda ditangguhkan permanen. Hubungi Admin Wesup.",
    );
    expect(getAccountStatusMessage("banned")).toBe(
      "Akun Anda diblokir. Hubungi Admin Wesup.",
    );
  });

  it("explains pending supplier verification without granting supplier role", () => {
    expect(getRoleMismatchMessage("supplier", "pending")).toBe(
      "Pendaftaran pemasok Anda masih menunggu verifikasi Admin.",
    );
  });
});
