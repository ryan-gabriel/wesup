export type UserRole = "supplier" | "umkm" | "admin";
export type AccountStatus = "active" | "suspended_temporary" | "suspended_permanent" | "banned";
export type VerificationStatus = "pending" | "approved" | "rejected";

export interface AccountProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  phone: string | null;
  createdAt: string;
  initials: string;
  verificationStatus?: VerificationStatus | null;
}

export interface SupplierLink {
  label: string;
  description: string;
  href: string;
}

export const ROLE_META: Record<UserRole, { label: string; className: string }> = {
  supplier: { label: "Supplier", className: "bg-violet-100 text-violet-700" },
  umkm: { label: "UMKM", className: "bg-teal-100 text-teal-700" },
  admin: { label: "Admin", className: "bg-indigo-100 text-indigo-700" },
};

export const STATUS_META: Record<AccountStatus, { label: string; className: string }> = {
  active: { label: "Aktif", className: "bg-emerald-100 text-emerald-700" },
  suspended_temporary: { label: "Suspended Sementara", className: "bg-amber-100 text-amber-700" },
  suspended_permanent: { label: "Suspended Permanen", className: "bg-red-100 text-red-700" },
  banned: { label: "Dibanned", className: "bg-red-100 text-red-700" },
};

export const ACCOUNT_PROFILE_MOCK: AccountProfile = {
  id: "user-001",
  fullName: "Rina Suryani",
  email: "rina@tokosembako.com",
  role: "umkm",
  status: "active",
  phone: "+62 812-3456-7890",
  createdAt: "2026-07-15T08:00:00.000Z",
  initials: "RS",
};

export const SUPPLIER_PROFILE_MOCK: AccountProfile = {
  id: "user-010",
  fullName: "PT Agri Sejahtera",
  email: "info@agrisejahtera.co.id",
  role: "supplier",
  status: "active",
  phone: "+62 821-9876-5432",
  createdAt: "2026-06-20T08:00:00.000Z",
  initials: "PA",
  verificationStatus: "approved",
};

export const SUPPLIER_ACCOUNT_LINKS: readonly SupplierLink[] = [
  {
    label: "Rekening Pencairan",
    description: "Atur rekening tujuan pencairan escrow",
    href: "/supplier/akun/rekening",
  },
  {
    label: "Escrow Aktif",
    description: "Pantau dana escrow yang sedang ditahan",
    href: "/supplier/akun/escrow",
  },
  {
    label: "Laporan & Riwayat",
    description: "Riwayat laporan terkait pesanan dan escrow",
    href: "/supplier/akun/laporan",
  },
];