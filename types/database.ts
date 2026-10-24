export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "supplier" | "umkm" | "admin";
export type AccountStatus =
  "active" | "suspended_temporary" | "suspended_permanent" | "banned";
export type VerificationStatus = "pending" | "approved" | "rejected";
export type BatchStatus =
  "draft" | "published" | "closed" | "cancelled" | "takedown" | "completed";
export type RegistrationStatus =
  | "registered"
  | "pending_payment"
  | "paid"
  | "picked_up"
  | "completed"
  | "no_show"
  | "cancelled"
  | "refund_pending"
  | "refunded";
export type PaymentStatus =
  "pending" | "paid" | "expired" | "failed" | "refunded";
export type EscrowStatus = "held" | "frozen" | "released" | "refunded" | "forfeited";
export type PaymentAttemptStatus = "pending" | "paid" | "expired" | "failed";
export type PaymentIntegrationType = "core_qris" | "snap";
export type ComplaintCategory = "cacat" | "busuk";
export type SupplierLedgerBucket = "escrow" | "frozen" | "available" | "paid_out" | "refunded";
export type SupplierPayoutStatus = "requested" | "approved" | "transferred" | "rejected";
export type BatchCloseReason =
  | "capacity_reached"
  | "registration_expired"
  | "supplier_manual"
  | "supplier_cancelled"
  | "admin_cancelled"
  | "no_registrations";
export type DisputeStatus =
  "pending" | "under_review" | "resolved_supplier" | "resolved_umkm";
export type RefundTrigger =
  | "takedown"
  | "force_majeure"
  | "dispute_won"
  | "supplier_cancel";
export type RefundStatus =
  "pending" | "waiting_bank_account" | "processing" | "completed" | "failed";
export type NotificationType =
  | "payment_due"
  | "payment_success"
  | "pickup_ready"
  | "dispute"
  | "refund"
  | "suspension"
  | "referral"
  | "batch_update";
export type AuditAction =
  | "verify_supplier"
  | "reject_supplier"
  | "takedown_batch"
  | "resolve_dispute"
  | "approve_refund"
  | "complete_refund"
  | "suspend_user"
  | "ban_user"
  | "unban_user"
  | "cancel_batch"
  | "cut_off_batch"
  | "generate_pickup_code"
  | "confirm_pickup"
  | "create_recurring_config";

// Additive overlay until the migration is deployed and generated types are refreshed.
export type Database = import("./database.generated").Database & {
  public: { Functions: { simulate_demo_payment_paid: { Args: { p_registration_id: string; p_actor_id: string; p_batch_id: string; p_checkout_reference: string; p_request_id: string }; Returns: Json } }; Tables: { batches: {
    Row: { early_payment_minimum_quantity: number | null };
    Insert: { early_payment_minimum_quantity?: number | null };
    Update: { early_payment_minimum_quantity?: number | null };
  } } };
};

/** Historical hand-written contract retained for DTO compatibility reference. */
export interface LegacyDatabase {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          status: AccountStatus;
          full_name: string;
          phone: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          status?: AccountStatus;
          full_name: string;
          phone?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      supplier_profiles: {
        Row: {
          user_id: string;
          business_name: string;
          address: string;
          latitude: number;
          longitude: number;
          business_photo_url: string | null;
          ktp_photo_url: string | null;
          nik: string | null;
          verification_status: VerificationStatus;
          verification_notes: string | null;
          verified_by: string | null;
          verified_at: string | null;
          is_location_locked: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          business_name: string;
          address: string;
          latitude: number;
          longitude: number;
          business_photo_url?: string | null;
          ktp_photo_url?: string | null;
          nik?: string | null;
          verification_status?: VerificationStatus;
          verification_notes?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          is_location_locked?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["supplier_profiles"]["Insert"]
        >;
        Relationships: [];
      };
      supplier_bank_accounts: {
        Row: {
          id: string;
          supplier_id: string;
          bank_name: string;
          account_number: string;
          account_holder_name: string;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          bank_name: string;
          account_number: string;
          account_holder_name: string;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["supplier_bank_accounts"]["Insert"]
        >;
        Relationships: [];
      };
      umkm_profiles: {
        Row: {
          user_id: string;
          business_name: string | null;
          address: string | null;
          latitude: number;
          longitude: number;
          strike_count: number;
          suspended_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          business_name?: string | null;
          address?: string | null;
          latitude: number;
          longitude: number;
          strike_count?: number;
          suspended_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["umkm_profiles"]["Insert"]
        >;
        Relationships: [];
      };
      umkm_bank_accounts: {
        Row: {
          id: string;
          umkm_id: string;
          bank_name: string;
          account_number: string;
          account_holder_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          umkm_id: string;
          bank_name: string;
          account_number: string;
          account_holder_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["umkm_bank_accounts"]["Insert"]
        >;
        Relationships: [];
      };
      recurring_configs: {
        Row: {
          id: string;
          supplier_id: string;
          name: string | null;
          interval_days: number;
          days_of_week: number[];
          is_active: boolean;
          last_generated_at: string | null;
          next_generation_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          name?: string | null;
          interval_days: number;
          days_of_week?: number[];
          is_active?: boolean;
          last_generated_at?: string | null;
          next_generation_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["recurring_configs"]["Insert"]
        >;
        Relationships: [];
      };
      batches: {
        Row: {
          id: string;
          supplier_id: string;
          recurring_config_id: string | null;
          title: string;
          description: string | null;
          category: string;
          unit: string;
          min_quantity: number;
          capacity_quantity: number | null;
          early_payment_minimum_quantity: number | null;
          payment_window_hours: number;
          registration_closed_at: string | null;
          close_reason: BatchCloseReason | null;
          final_registered_quantity: number | null;
          locked_tier_number: number | null;
          locked_unit_price: number | null;
          invoices_issued_at: string | null;
          ready_at: string | null;
          completed_at: string | null;
          product_photo_url: string | null;
          pickup_name: string;
          pickup_address: string;
          latitude: number;
          longitude: number;
          status: BatchStatus;
          takedown_reason: string | null;
          takedown_by: string | null;
          takedown_at: string | null;
          cancelled_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          recurring_config_id?: string | null;
          title: string;
          description?: string | null;
          category: string;
          unit?: string;
          min_quantity: number;
          capacity_quantity?: number | null;
          early_payment_minimum_quantity?: number | null;
          payment_window_hours?: number;
          registration_closed_at?: string | null;
          close_reason?: BatchCloseReason | null;
          final_registered_quantity?: number | null;
          locked_tier_number?: number | null;
          locked_unit_price?: number | null;
          invoices_issued_at?: string | null;
          ready_at?: string | null;
          completed_at?: string | null;
          product_photo_url?: string | null;
          pickup_name?: string;
          pickup_address: string;
          latitude: number;
          longitude: number;
          status?: BatchStatus;
          takedown_reason?: string | null;
          takedown_by?: string | null;
          takedown_at?: string | null;
          cancelled_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["batches"]["Insert"]>;
        Relationships: [];
      };
      batch_tiers: {
        Row: {
          id: string;
          batch_id: string;
          tier_number: number;
          min_volume: number;
          max_volume: number | null;
          price_per_unit: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          batch_id: string;
          tier_number: number;
          min_volume: number;
          max_volume?: number | null;
          price_per_unit: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["batch_tiers"]["Insert"]>;
        Relationships: [];
      };
      batch_timeline: {
        Row: {
          batch_id: string;
          registration_opens_at: string;
          registration_closes_at: string;
          payment_opens_at: string;
          payment_closes_at: string;
          estimated_ready_at: string;
          effective_payment_opens_at: string | null;
          effective_payment_closes_at: string | null;
          created_at: string;
        };
        Insert: {
          batch_id: string;
          registration_opens_at: string;
          registration_closes_at: string;
          payment_opens_at: string;
          payment_closes_at: string;
          estimated_ready_at: string;
          effective_payment_opens_at?: string | null;
          effective_payment_closes_at?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["batch_timeline"]["Insert"]
        >;
        Relationships: [];
      };
      registrations: {
        Row: {
          id: string;
          batch_id: string;
          umkm_id: string;
          quantity: number;
          consented_at: string;
          consent_latitude: number | null;
          consent_longitude: number | null;
          status: RegistrationStatus;
          locked_tier_number: number | null;
          locked_price_per_unit: number | null;
          final_amount: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          batch_id: string;
          umkm_id: string;
          quantity: number;
          consented_at: string;
          consent_latitude?: number | null;
          consent_longitude?: number | null;
          status?: RegistrationStatus;
          locked_tier_number?: number | null;
          locked_price_per_unit?: number | null;
          final_amount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["registrations"]["Insert"]
        >;
        Relationships: [];
      };
      batch_status_events: {
        Row: {
          id: string;
          batch_id: string;
          from_status: BatchStatus | null;
          to_status: BatchStatus;
          source: string;
          actor_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          batch_id: string;
          from_status?: BatchStatus | null;
          to_status: BatchStatus;
          source: string;
          actor_id?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["batch_status_events"]["Insert"]>;
        Relationships: [];
      };
      supplier_ledger_entries: {
        Row: {
          id: string;
          supplier_id: string;
          registration_id: string | null;
          payout_id: string | null;
          from_bucket: SupplierLedgerBucket | null;
          to_bucket: SupplierLedgerBucket | null;
          amount: number;
          entry_type: string;
          idempotency_key: string;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          registration_id?: string | null;
          payout_id?: string | null;
          from_bucket?: SupplierLedgerBucket | null;
          to_bucket?: SupplierLedgerBucket | null;
          amount: number;
          entry_type: string;
          idempotency_key: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["supplier_ledger_entries"]["Insert"]>;
        Relationships: [];
      };
      supplier_payouts: {
        Row: {
          id: string;
          supplier_id: string;
          supplier_bank_account_id: string | null;
          amount: number;
          status: SupplierPayoutStatus;
          bank_account_snapshot: Record<string, unknown>;
          transfer_proof_url: string | null;
          requested_at: string;
          approved_at: string | null;
          transferred_at: string | null;
          processed_by: string | null;
          notes: string | null;
          idempotency_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          supplier_bank_account_id?: string | null;
          amount: number;
          status?: SupplierPayoutStatus;
          bank_account_snapshot: Record<string, unknown>;
          transfer_proof_url?: string | null;
          requested_at?: string;
          approved_at?: string | null;
          transferred_at?: string | null;
          processed_by?: string | null;
          notes?: string | null;
          idempotency_key: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["supplier_payouts"]["Insert"]>;
        Relationships: [];
      };
      registration_status_events: {
        Row: {
          id: string;
          registration_id: string;
          from_status: RegistrationStatus | null;
          to_status: RegistrationStatus;
          source: string;
          actor_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          registration_id: string;
          from_status?: RegistrationStatus | null;
          to_status: RegistrationStatus;
          source: string;
          actor_id?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["registration_status_events"]["Insert"]>;
        Relationships: [];
      };
      registration_counters: {
        Row: {
          batch_id: string;
          current_count: number;
          updated_at: string;
        };
        Insert: {
          batch_id: string;
          current_count?: number;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["registration_counters"]["Insert"]
        >;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          registration_id: string;
          midtrans_order_id: string;
          midtrans_transaction_id: string | null;
          gross_amount: number;
          status: PaymentStatus;
          qr_code_url: string | null;
          qr_code_expires_at: string | null;
          paid_at: string | null;
          webhook_payload: Record<string, unknown> | null;
          reconciled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          registration_id: string;
          midtrans_order_id: string;
          midtrans_transaction_id?: string | null;
          gross_amount: number;
          status?: PaymentStatus;
          qr_code_url?: string | null;
          qr_code_expires_at?: string | null;
          paid_at?: string | null;
          webhook_payload?: Record<string, unknown> | null;
          reconciled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      payment_webhook_logs: {
        Row: {
          id: string;
          payment_id: string;
          event_type: string;
          payload: Record<string, unknown>;
          payload_hash: string | null;
          status: string;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          event_type: string;
          payload: Record<string, unknown>;
          payload_hash?: string | null;
          status?: string;
          error_message?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["payment_webhook_logs"]["Insert"]
        >;
        Relationships: [];
      };
      payment_attempts: {
        Row: {
          id: string;
          payment_id: string;
          provider_order_id: string;
          provider_transaction_id: string | null;
          status: PaymentAttemptStatus;
          integration_type: PaymentIntegrationType;
          provider_status: string | null;
          payment_type: string | null;
          provider_fraud_status: string | null;
          qr_code_url: string | null;
          expires_at: string | null;
          idempotency_key: string;
          provider_payload: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          provider_order_id: string;
          provider_transaction_id?: string | null;
          status?: PaymentAttemptStatus;
          integration_type?: PaymentIntegrationType;
          provider_status?: string | null;
          payment_type?: string | null;
          provider_fraud_status?: string | null;
          qr_code_url?: string | null;
          expires_at?: string | null;
          idempotency_key: string;
          provider_payload?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_attempts"]["Insert"]>;
        Relationships: [];
      };
      payment_checkout_sessions: {
        Row: {
          id: string;
          payment_attempt_id: string;
          snap_token: string;
          redirect_url: string | null;
          expires_at: string;
          created_at: string;
          updated_at: string;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          payment_attempt_id: string;
          snap_token: string;
          redirect_url?: string | null;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["payment_checkout_sessions"]["Insert"]>;
        Relationships: [];
      };
      pickup_codes: {
        Row: {
          id: string;
          registration_id: string;
          qr_code_token: string;
          pin_code: string;
          generated_at: string;
          used_at: string | null;
          used_by_supplier_id: string | null;
        };
        Insert: {
          id?: string;
          registration_id: string;
          qr_code_token: string;
          pin_code: string;
          generated_at?: string;
          used_at?: string | null;
          used_by_supplier_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["pickup_codes"]["Insert"]>;
        Relationships: [];
      };
      pickup_events: {
        Row: {
          id: string;
          registration_id: string;
          supplier_id: string;
          method: "qr" | "pin";
          latitude: number | null;
          longitude: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          registration_id: string;
          supplier_id: string;
          method: "qr" | "pin";
          latitude?: number | null;
          longitude?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["pickup_events"]["Insert"]
        >;
        Relationships: [];
      };
      escrow_holds: {
        Row: {
          id: string;
          registration_id: string;
          amount: number;
          status: EscrowStatus;
          pickup_confirmed_at: string | null;
          auto_release_at: string | null;
          released_at: string | null;
          release_destination: "supplier" | "umkm" | null;
          dispute_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          registration_id: string;
          amount: number;
          status?: EscrowStatus;
          pickup_confirmed_at?: string | null;
          auto_release_at?: string | null;
          released_at?: string | null;
          release_destination?: "supplier" | "umkm" | null;
          dispute_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["escrow_holds"]["Insert"]>;
        Relationships: [];
      };
      disputes: {
        Row: {
          id: string;
          registration_id: string;
          umkm_id: string;
          supplier_id: string;
          complaint_category: ComplaintCategory;
          description: string;
          photo_urls: string[];
          status: DisputeStatus;
          admin_id: string | null;
          admin_notes: string | null;
          decided_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          registration_id: string;
          umkm_id: string;
          supplier_id: string;
          complaint_category?: ComplaintCategory;
          description: string;
          photo_urls?: string[];
          status?: DisputeStatus;
          admin_id?: string | null;
          admin_notes?: string | null;
          decided_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["disputes"]["Insert"]>;
        Relationships: [];
      };
      dispute_evidence: {
        Row: {
          id: string;
          dispute_id: string;
          uploaded_by: string;
          file_url: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          dispute_id: string;
          uploaded_by: string;
          file_url: string;
          description?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["dispute_evidence"]["Insert"]
        >;
        Relationships: [];
      };
      refund_requests: {
        Row: {
          id: string;
          registration_id: string;
          batch_id: string;
          trigger_type: RefundTrigger;
          amount: number;
          status: RefundStatus;
          umkm_bank_account_id: string | null;
          admin_id: string | null;
          admin_notes: string | null;
          transfer_proof_url: string | null;
          requested_at: string;
          processed_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          registration_id: string;
          batch_id: string;
          trigger_type: RefundTrigger;
          amount: number;
          status?: RefundStatus;
          umkm_bank_account_id?: string | null;
          admin_id?: string | null;
          admin_notes?: string | null;
          transfer_proof_url?: string | null;
          requested_at?: string;
          processed_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["refund_requests"]["Insert"]
        >;
        Relationships: [];
      };
      ratings: {
        Row: {
          id: string;
          registration_id: string;
          umkm_id: string;
          supplier_id: string;
          score: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          registration_id: string;
          umkm_id: string;
          supplier_id: string;
          score: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ratings"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          message: string;
          data: Record<string, unknown> | null;
          read_at: string | null;
          sent_via_whatsapp: boolean;
          whatsapp_status: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title: string;
          message: string;
          data?: Record<string, unknown> | null;
          read_at?: string | null;
          sent_via_whatsapp?: boolean;
          whatsapp_status?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["notifications"]["Insert"]
        >;
        Relationships: [];
      };
      admin_audit_logs: {
        Row: {
          id: string;
          admin_id: string;
          action_type: AuditAction;
          target_type: string;
          target_id: string;
          details: Record<string, unknown> | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          action_type: AuditAction;
          target_type: string;
          target_id: string;
          details?: Record<string, unknown> | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["admin_audit_logs"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      apply_hit_and_run_escalation: {
        Args: {
          p_umkm_id: string;
          p_payment_window_closed_at: string;
          p_registration_id?: string | null;
        };
        Returns: undefined;
      };
      lazy_lift_expired_suspension: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      reconcile_batch_payment_window: {
        Args: { p_batch_id: string };
        Returns: Json;
      };
      sum_registered_quantity: {
        Args: { p_batch_id: string };
        Returns: number;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_supplier: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_approved_supplier: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      create_supplier_registration: {
        Args: {
          p_user_id: string;
          p_business_name: string;
          p_address: string;
          p_latitude: number;
          p_longitude: number;
          p_business_photo_url: string;
        };
        Returns: void;
      };
      create_umkm_registration: {
        Args: {
          p_user_id: string;
          p_latitude: number;
          p_longitude: number;
        };
        Returns: void;
      };
      is_email_registered: {
        Args: { p_email: string };
        Returns: boolean;
      };
      approve_supplier: {
        Args: {
          p_user_id: string;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: void;
      };
      reject_supplier: {
        Args: {
          p_user_id: string;
          p_reason: string;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: void;
      };
      takedown_batch: {
        Args: {
          p_batch_id: string;
          p_reason: string;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: void;
      };
      resolve_dispute: {
        Args: {
          p_dispute_id: string;
          p_winner: string;
          p_notes?: string | null;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: void;
      };
      approve_refund: {
        Args: {
          p_refund_id: string;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: void;
      };
      complete_refund: {
        Args: {
          p_refund_id: string;
          p_transfer_proof_url: string;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: void;
      };
      suspend_user: {
        Args: {
          p_user_id: string;
          p_suspended_until: string;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: void;
      };
      ban_user: {
        Args: {
          p_user_id: string;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: void;
      };
      unban_user: {
        Args: {
          p_user_id: string;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: void;
      };
      write_audit_log: {
        Args: {
          p_admin_id: string;
          p_action: AuditAction;
          p_target_type: string;
          p_target_id: string;
          p_details?: Record<string, unknown> | null;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: void;
      };
      cancel_batch: {
        Args: {
          p_batch_id: string;
          p_reason: string;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: void;
      };
      catalog_supplier_approved: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      create_supplier_batch: {
        Args: {
          p_title: string;
          p_description: string;
          p_category: string;
          p_min_quantity: number;
          p_pickup_name: string;
          p_pickup_address: string;
          p_latitude: number;
          p_longitude: number;
          p_registration_opens_at: string;
          p_registration_closes_at: string;
          p_payment_opens_at: string;
          p_payment_closes_at: string;
          p_estimated_ready_at: string;
          p_tiers: unknown;
        };
        Returns: string;
      };
      create_supplier_batch_v2: {
        Args: {
          p_title: string;
          p_description: string;
          p_category: string;
          p_min_quantity: number;
          p_capacity_quantity: number;
          p_unit: string;
          p_payment_window_hours: number;
          p_pickup_name: string;
          p_pickup_address: string;
          p_latitude: number;
          p_longitude: number;
          p_registration_opens_at: string;
          p_registration_closes_at: string;
          p_payment_opens_at: string;
          p_payment_closes_at: string;
          p_estimated_ready_at: string;
          p_tiers: unknown;
        };
        Returns: string;
      };
      publish_supplier_batch: {
        Args: { p_batch_id: string; p_product_photo_url: string };
        Returns: void;
      };
      update_and_publish_supplier_batch: { Args: { p_batch_id: string; p_title: string; p_description: string; p_category: string; p_min_quantity: number; p_product_photo_url: string; p_pickup_name: string; p_pickup_address: string; p_latitude: number; p_longitude: number; p_registration_opens_at: string; p_registration_closes_at: string; p_payment_opens_at: string; p_payment_closes_at: string; p_estimated_ready_at: string; p_tiers: unknown; }; Returns: void; };
      update_and_publish_supplier_batch_v2: { Args: { p_batch_id: string; p_title: string; p_description: string; p_category: string; p_min_quantity: number; p_capacity_quantity: number; p_unit: string; p_payment_window_hours: number; p_product_photo_url: string; p_pickup_name: string; p_pickup_address: string; p_latitude: number; p_longitude: number; p_registration_opens_at: string; p_registration_closes_at: string; p_payment_opens_at: string; p_payment_closes_at: string; p_estimated_ready_at: string; p_tiers: unknown; }; Returns: void; };
      update_supplier_batch: {
        Args: {
          p_batch_id: string;
          p_title: string;
          p_description: string;
          p_category: string;
          p_min_quantity: number;
          p_product_photo_url: string | null;
          p_pickup_name: string;
          p_pickup_address: string;
          p_latitude: number;
          p_longitude: number;
          p_registration_opens_at: string;
          p_registration_closes_at: string;
          p_payment_opens_at: string;
          p_payment_closes_at: string;
          p_estimated_ready_at: string;
          p_tiers: unknown;
        };
        Returns: void;
      };
      update_supplier_batch_v2: {
        Args: {
          p_batch_id: string;
          p_title: string;
          p_description: string;
          p_category: string;
          p_min_quantity: number;
          p_capacity_quantity: number;
          p_unit: string;
          p_payment_window_hours: number;
          p_product_photo_url: string | null;
          p_pickup_name: string;
          p_pickup_address: string;
          p_latitude: number;
          p_longitude: number;
          p_registration_opens_at: string;
          p_registration_closes_at: string;
          p_payment_opens_at: string;
          p_payment_closes_at: string;
          p_estimated_ready_at: string;
          p_tiers: unknown;
        };
        Returns: void;
      };
      delete_supplier_batch: {
        Args: { p_batch_id: string };
        Returns: void;
      };
      get_supplier_batch: {
        Args: { p_batch_id: string };
        Returns: {
          id: string;
          supplier_name: string;
          title: string;
          description: string | null;
          category: string;
          min_quantity: number;
          product_photo_url: string | null;
          pickup_name: string;
          pickup_address: string;
          latitude: number;
          longitude: number;
          status: BatchStatus;
          registration_opens_at: string;
          registration_closes_at: string;
          payment_opens_at: string;
          payment_closes_at: string;
          estimated_ready_at: string;
          tiers: unknown;
          registered_quantity: number;
          participant_count: number;
          paid_participant_count: number;
          cancelled_reason: string | null;
          updated_at: string;
          created_at: string;
        }[];
      };
      list_supplier_batches: {
        Args: { p_status?: BatchStatus | null; p_query?: string | null };
        Returns: {
          id: string;
          supplier_name: string;
          title: string;
          description: string | null;
          category: string;
          min_quantity: number;
          product_photo_url: string | null;
          pickup_name: string;
          pickup_address: string;
          latitude: number;
          longitude: number;
          status: BatchStatus;
          registration_opens_at: string;
          registration_closes_at: string;
          payment_opens_at: string;
          payment_closes_at: string;
          estimated_ready_at: string;
          tiers: unknown;
          registered_quantity: number;
          participant_count: number;
          paid_participant_count: number;
          cancelled_reason: string | null;
          updated_at: string;
          created_at: string;
        }[];
      };
      get_supplier_batch_transaction: {
        Args: { p_batch_id: string };
        Returns: Record<string, unknown>;
      };
      apply_midtrans_payment_event: {
        Args: {
          p_payment_attempt_id: string;
          p_provider_status: string;
          p_provider_transaction_id?: string | null;
          p_payment_type?: string | null;
          p_fraud_status?: string | null;
          p_payload?: Record<string, unknown>;
        };
        Returns: Record<string, unknown>;
      };      close_batch_and_issue_invoices: {
        Args: { p_batch_id: string; p_trigger: string; p_ip_address?: string | null; p_user_agent?: string | null };
        Returns: Record<string, unknown>;
      };
      materialize_supplier_batch: {
        Args: { p_batch_id: string };
        Returns: Record<string, unknown>;
      };
      mark_supplier_batch_ready: {
        Args: { p_batch_id: string };
        Returns: void;
      };
      cancel_supplier_batch: {
        Args: { p_batch_id: string; p_reason: string };
        Returns: void;
      };
      request_supplier_payout: {
        Args: { p_amount: number; p_bank_account_id: string; p_idempotency_key: string };
        Returns: string;
      };
      complete_supplier_payout: {
        Args: { p_payout_id: string; p_status: string; p_transfer_proof_url?: string | null; p_notes?: string | null };
        Returns: void;
      };
      upsert_supplier_bank_account: {
        Args: { p_bank_account_id?: string | null; p_bank_name: string; p_account_number: string; p_account_holder_name: string; p_is_primary?: boolean };
        Returns: string;
      };
      get_supplier_finance: {
        Args: Record<PropertyKey, never>;
        Returns: Record<string, unknown>;
      };
      materialize_supplier_order: {
        Args: { p_registration_id: string };
        Returns: RegistrationStatus;
      };
      materialize_umkm_orders: {
        Args: { p_registration_ids: string[] };
        Returns: number;
      };
      get_supplier_dashboard_summary: {
        Args: Record<PropertyKey, never>;
        Returns: {
          supplier_name: string;
          supplier_status: VerificationStatus;
          active_batch_count: number;
          total_participant_count: number;
          collected_revenue: number;
          ready_to_disburse: number;
          average_rating: number;
          rating_count: number;
          recent_batches: unknown;
        }[];
      };
      search_batches: {
        Args: {
          p_query?: string | null;
          p_categories?: string[] | null;
          p_lat?: number | null;
          p_lng?: number | null;
          p_radius_km?: number | null;
          p_min_price?: number | null;
          p_max_price?: number | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: {
          id: string;
          supplier_name: string;
          title: string;
          description: string | null;
          category: string;
          min_quantity: number;
          product_photo_url: string | null;
          pickup_address: string;
          latitude: number;
          longitude: number;
          tiers: unknown;
          registered_quantity: number;
          current_price_per_unit: number;
          registration_closes_at: string | null;
          distance_km: number | null;
          total_count: number;
          batch_status: string;
          registration_opens_at: string | null;
          capacity_quantity: number | null;
          can_register: boolean;
          unavailable_reason: string | null;
          remaining_quantity: number | null;
          server_time: string;
        }[];
      };
      get_marketplace_batch: {
        Args: {
          p_batch_id: string;
          p_lat?: number | null;
          p_lng?: number | null;
        };
        Returns: {
          id: string;
          supplier_name: string;
          title: string;
          description: string | null;
          category: string;
          min_quantity: number;
          product_photo_url: string | null;
          pickup_address: string;
          latitude: number;
          longitude: number;
          tiers: unknown;
          registered_quantity: number;
          current_price_per_unit: number;
          registration_closes_at: string | null;
          distance_km: number | null;
          total_count: number;
          batch_status: string;
          registration_opens_at: string | null;
          capacity_quantity: number | null;
          can_register: boolean;
          unavailable_reason: string | null;
          remaining_quantity: number | null;
          server_time: string;
        }[];
      };
      cut_off_batch: {
        Args: {
          p_batch_id: string;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: void;
      };
      is_supplier_approved: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      create_batch: {
        Args: {
          p_title: string;
          p_description?: string | null;
          p_category: string;
          p_min_quantity: number;
          p_product_photo_url?: string | null;
          p_pickup_address: string;
          p_latitude: number;
          p_longitude: number;
          p_registration_opens_at: string;
          p_registration_closes_at: string;
          p_payment_opens_at: string;
          p_payment_closes_at: string;
          p_estimated_ready_at: string;
          p_tiers: unknown;
          p_recurring_config_id?: string | null;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: string;
      };
      update_batch: {
        Args: {
          p_batch_id: string;
          p_title?: string | null;
          p_description?: string | null;
          p_category?: string | null;
          p_product_photo_url?: string | null;
          p_pickup_address?: string | null;
          p_latitude?: number | null;
          p_longitude?: number | null;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: void;
      };
      delete_batch: {
        Args: {
          p_batch_id: string;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: void;
      };
      list_own_batches: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          title: string;
          category: string;
          status: string;
          min_quantity: number;
          pickup_address: string;
          latitude: number;
          longitude: number;
          registration_opens_at: string | null;
          registration_closes_at: string | null;
          payment_opens_at: string | null;
          payment_closes_at: string | null;
          estimated_ready_at: string | null;
          tiers: unknown;
          created_at: string;
        }[];
      };
      create_recurring_config: {
        Args: {
          p_name?: string | null;
          p_interval_days?: number;
          p_days_of_week?: unknown[];
        };
        Returns: string;
      };
      generate_pickup_code: {
        Args: {
          p_registration_id: string;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: {
          qr_code_token: string;
          pin_code: string;
        }[];
      };
      confirm_pickup: {
        Args: {
          p_registration_id: string;
          p_method: string;
          p_code?: string | null;
          p_latitude?: number | null;
          p_longitude?: number | null;
          p_notes?: string | null;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: void;
      };
      create_escrow: {
        Args: {
          p_registration_id: string;
          p_pickup_confirmed_at?: string;
        };
        Returns: void;
      };
      list_batch_orders: {
        Args: {
          p_batch_id: string;
        };
        Returns: {
          registration_id: string;
          umkm_name: string;
          quantity: number;
          status: string;
          final_amount: number | null;
          lock_tier: number | null;
          created_at: string;
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
      account_status: AccountStatus;
      verification_status: VerificationStatus;
      batch_status: BatchStatus;
      registration_status: RegistrationStatus;
      payment_status: PaymentStatus;
      escrow_status: EscrowStatus;
      dispute_status: DisputeStatus;
      refund_trigger: RefundTrigger;
      refund_status: RefundStatus;
      notification_type: NotificationType;
      audit_action: AuditAction;
    };
    CompositeTypes: Record<string, never>;
  };
}
