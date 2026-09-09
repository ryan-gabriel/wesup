import type { ReactNode } from "react";

export type AppNotificationType =
  | "payment_due"
  | "payment_success"
  | "pickup_ready"
  | "dispute"
  | "refund"
  | "suspension"
  | "referral"
  | "batch_update";

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  /** Optional destination the item links to. */
  href?: string;
  /** Per-type icon shown in the feed. */
  icon?: ReactNode;
}