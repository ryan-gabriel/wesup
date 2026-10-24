import type { OpenAPIV3 } from "openapi-types";
import { ref, schemas } from "@/lib/openapi/schemas";

type Schema = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
type AuthKind = "public" | "session" | "umkm" | "supplier" | "supplierOrAdmin" | "admin" | "webhook";

const json = (properties: Record<string, Schema>, required: string[] = []): OpenAPIV3.SchemaObject => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
});

const arrayOf = (items: Schema): OpenAPIV3.SchemaObject => ({ type: "array", items });

const parameter = (
  name: string,
  inValue: "path" | "query" | "header",
  schema: Schema,
  required = inValue === "path",
  description?: string,
): OpenAPIV3.ParameterObject => ({ name, in: inValue, required, schema, description });

const jsonBody = (
  properties: Record<string, Schema>,
  required: string[] = [],
  description?: string,
): OpenAPIV3.RequestBodyObject => ({
  required: required.length > 0,
  description,
  content: { "application/json": { schema: json(properties, required) } },
});

const multipartBody = (
  properties: Record<string, Schema>,
  required: string[] = [],
  description?: string,
): OpenAPIV3.RequestBodyObject => ({
  required: required.length > 0,
  description,
  content: { "multipart/form-data": { schema: json(properties, required) } },
});


const securityFor = (kind: AuthKind): OpenAPIV3.SecurityRequirementObject[] => {
  if (kind === "public") return [];
  if (kind === "webhook") return [];
  return [{ supabaseCookie: [] }];
};

const authDescription = (kind: AuthKind): string => {
  switch (kind) {
    case "public": return "Endpoint publik.";
    case "session": return "Memerlukan sesi Supabase yang valid.";
    case "umkm": return "Memerlukan sesi Supabase dan akun UMKM aktif.";
    case "supplier": return "Memerlukan sesi Supabase dan akun Supplier aktif/disetujui.";
    case "supplierOrAdmin": return "Memerlukan sesi Supabase dengan role Supplier pemilik atau Admin.";
    case "admin": return "Memerlukan sesi Supabase dengan role Admin.";
    case "webhook": return "Tidak memakai cookie; signature Midtrans dan nominal webhook diverifikasi di server.";
  }
};

const response = (description: string, schema?: Schema): OpenAPIV3.ResponseObject => ({
  description,
  ...(schema ? { content: { "application/json": { schema } } } : {}),
});

const standardErrors = (codes: number[]): OpenAPIV3.ResponsesObject => {
  const result: OpenAPIV3.ResponsesObject = {};
  for (const code of codes) result[String(code)] = response(`Error HTTP ${code}.`, ref("ErrorResponse"));
  return result;
};

interface OperationOptions {
  tag: string;
  summary: string;
  auth?: AuthKind;
  parameters?: OpenAPIV3.ParameterObject[];
  requestBody?: OpenAPIV3.RequestBodyObject;
  successStatus?: number;
  successSchema?: Schema;
  errors?: number[];
  description?: string;
}

const operation = ({
  tag,
  summary,
  auth = "public",
  parameters = [],
  requestBody,
  successStatus = 200,
  successSchema = ref("OkResponse"),
  errors = [400, 401, 403, 500],
  description,
}: OperationOptions): OpenAPIV3.OperationObject => ({
  tags: [tag],
  summary,
  description: `${description ?? summary} ${authDescription(auth)}`,
  security: securityFor(auth),
  parameters,
  ...(requestBody ? { requestBody } : {}),
  responses: {
    [String(successStatus)]: response("Berhasil.", successSchema),
    ...standardErrors(errors),
  },
});

const uuid = { type: "string", format: "uuid" } satisfies OpenAPIV3.SchemaObject;
const string = { type: "string" } satisfies OpenAPIV3.SchemaObject;
const integer = { type: "integer" } satisfies OpenAPIV3.SchemaObject;
const boolean = { type: "boolean" } satisfies OpenAPIV3.SchemaObject;

const id = (name = "id") => parameter(name, "path", uuid);
const queryString = (name: string, description?: string) => parameter(name, "query", string, false, description);
const queryInt = (name: string, description?: string) => parameter(name, "query", integer, false, description);

const paths: OpenAPIV3.PathsObject = {
  "/api/admin/audit-logs": {
    get: operation({ tag: "Admin", summary: "Daftar audit log", auth: "admin", parameters: [queryString("action_type"), queryString("admin_id"), queryInt("limit"), queryInt("offset")], successSchema: json({ logs: arrayOf(json({ id: uuid, action: string, createdAt: string }, [])) }), errors: [400, 401, 403, 500] }),
  },
  "/api/admin/batches/{id}/takedown": { post: operation({ tag: "Admin", summary: "Takedown batch", auth: "admin", parameters: [id()], requestBody: jsonBody({ reason: string }, ["reason"]) }) },
  "/api/admin/disputes/{id}/resolve": { post: operation({ tag: "Admin", summary: "Selesaikan sengketa", auth: "admin", parameters: [id()], requestBody: jsonBody({ winner: { type: "string", enum: ["supplier", "umkm"] }, notes: string }, ["winner"]) }) },
  "/api/admin/refunds": { get: operation({ tag: "Admin", summary: "Daftar refund", auth: "admin", parameters: [queryString("status"), queryInt("limit"), queryInt("offset")], successSchema: json({ refunds: arrayOf(ref("Order")) }) }) },
  "/api/admin/refunds/{id}/approve": { post: operation({ tag: "Admin", summary: "Setujui refund", auth: "admin", parameters: [id()] }) },
  "/api/admin/refunds/{id}/complete": { post: operation({ tag: "Admin", summary: "Selesaikan transfer refund", auth: "admin", parameters: [id()], requestBody: jsonBody({ transfer_proof_url: string }, ["transfer_proof_url"]) }) },
  "/api/admin/supplier-payouts/{payoutId}": { patch: operation({ tag: "Admin", summary: "Perbarui payout Supplier", auth: "admin", parameters: [id("payoutId")], requestBody: jsonBody({ status: { type: "string", enum: ["approved", "transferred", "rejected"] }, transferProofUrl: string, notes: string }, ["status"]), errors: [400, 401, 403, 404, 409] }) },
  "/api/admin/suppliers/{id}/approve": { post: operation({ tag: "Admin", summary: "Setujui Supplier", auth: "admin", parameters: [id()] }) },
  "/api/admin/suppliers/{id}/reject": { post: operation({ tag: "Admin", summary: "Tolak Supplier", auth: "admin", parameters: [id()], requestBody: jsonBody({ reason: string }, ["reason"]) }) },
  "/api/admin/users/{id}/ban": { post: operation({ tag: "Admin", summary: "Ban user", auth: "admin", parameters: [id()] }) },
  "/api/admin/users/{id}/suspend": { post: operation({ tag: "Admin", summary: "Suspend user", auth: "admin", parameters: [id()], requestBody: jsonBody({ suspended_until: { type: "string", format: "date-time" } }, ["suspended_until"]) }) },
  "/api/admin/users/{id}/unban": { post: operation({ tag: "Admin", summary: "Cabut ban user", auth: "admin", parameters: [id()] }) },

  "/api/auth/forgot-password": { post: operation({ tag: "Authentication", summary: "Minta reset password", requestBody: jsonBody({ email: { type: "string", format: "email" } }, ["email"]), errors: [400, 429] }) },
  "/api/auth/login": { post: operation({ tag: "Authentication", summary: "Login", requestBody: jsonBody({ email: { type: "string", format: "email" }, password: string, role: { type: "string", enum: ["umkm", "supplier", "admin"] }, returnTo: string }, ["email", "password", "role"]), successSchema: json({ user: json({ id: uuid }), profile: json({ role: string }), redirectTo: string }), errors: [400, 401, 403, 500] }) },
  "/api/auth/logout": { post: operation({ tag: "Authentication", summary: "Logout", auth: "session", errors: [401, 500] }) },
  "/api/auth/reset-password": { post: operation({ tag: "Authentication", summary: "Reset password", requestBody: jsonBody({ code: string, password: string }, ["code", "password"]), errors: [400, 429] }) },
  "/api/auth/session": { get: operation({ tag: "Authentication", summary: "Ambil sesi aktif", auth: "session", successSchema: json({ user: json({ id: uuid }), profile: json({ role: string }), accessState: string, homePath: string }), errors: [401, 403] }) },
  "/api/auth/signup": { post: operation({ tag: "Authentication", summary: "Buat akun UMKM", requestBody: jsonBody({ full_name: string, email: { type: "string", format: "email" }, phone: string, password: string, latitude: { type: "number" }, longitude: { type: "number" } }, ["full_name", "email", "phone", "password"]), successStatus: 201, successSchema: json({ ok: boolean, requiresEmailConfirmation: boolean }), errors: [400, 409, 429, 500] }) },

  "/api/batches/{id}/cutoff": { post: operation({ tag: "Batch", summary: "Materialisasi cutoff batch", auth: "supplierOrAdmin", parameters: [id()], errors: [400, 401, 403, 409, 500] }) },
  "/api/batches/{id}/progress": { get: operation({ tag: "Batch", summary: "Lihat progress batch", parameters: [id()], successSchema: json({ batchId: uuid, status: string, registeredQuantity: integer, tiers: arrayOf(json({ tierNumber: integer, pricePerUnit: integer })), availability: ref("MarketplaceAvailability"), registrationOpensAt: { type: "string", format: "date-time" }, registrationClosesAt: { type: "string", format: "date-time" }, serverTime: { type: "string", format: "date-time" } }), errors: [400, 404, 500, 503] }) },
  "/api/marketplace/search": { get: operation({ tag: "Marketplace", summary: "Cari batch marketplace", parameters: [queryString("q"), queryString("categories"), queryString("lat"), queryString("lng"), queryString("radius"), queryString("minPrice"), queryString("maxPrice"), queryInt("limit"), queryInt("page")], successSchema: json({ items: arrayOf(ref("MarketplaceOffer")), serverTime: { type: "string", format: "date-time" }, total: integer, page: integer, pageSize: integer, totalPages: integer, origin: json({ latitude: { type: "number", nullable: true }, longitude: { type: "number", nullable: true } }) }), errors: [400, 500, 503] }) },
  "/api/marketplace/{id}": { get: operation({ tag: "Marketplace", summary: "Detail batch marketplace", parameters: [id(), queryString("lat"), queryString("lng")], successSchema: ref("MarketplaceOffer"), errors: [400, 404, 500] }) },
  "/api/marketplace/{id}/route": { get: operation({ tag: "Marketplace", summary: "Rute pickup batch", auth: "umkm", parameters: [id()], successSchema: json({ route: json({}, []) }), errors: [400, 401, 403, 404, 409, 429, 500] }) },
  "/api/registrations": { post: operation({ tag: "Registrations", summary: "Daftar ke batch", auth: "umkm", requestBody: jsonBody({ batchId: uuid, quantity: integer, consentLat: { type: "number" }, consentLng: { type: "number" } }, ["batchId", "quantity"]), successStatus: 201, successSchema: ref("Order"), errors: [400, 401, 403, 404, 409, 500, 503] }) },
  "/api/pickups/{registrationId}/code": { post: operation({ tag: "Pickup", summary: "Terbitkan QR/PIN pickup", auth: "session", parameters: [id("registrationId")], successSchema: json({ qrCodeToken: string, pinCode: string }), errors: [400, 401, 403, 404, 409, 500] }) },
  "/api/pickups/{registrationId}/confirm": { post: operation({ tag: "Pickup", summary: "Konfirmasi pickup", auth: "supplierOrAdmin", parameters: [id("registrationId")], requestBody: jsonBody({ method: { type: "string", enum: ["qr", "pin"] }, code: string, latitude: { type: "number" }, longitude: { type: "number" }, notes: string }, ["method", "code"]), errors: [400, 401, 403, 404, 409, 500] }) },

  "/api/suppliers/register": { post: operation({ tag: "Supplier", summary: "Registrasi Supplier", requestBody: multipartBody({ fullName: string, email: { type: "string", format: "email" }, phone: string, password: string, confirmPassword: string, businessName: string, address: string, latitude: { type: "number" }, longitude: { type: "number" }, businessPhoto: { type: "string", format: "binary" } }, ["fullName", "email", "phone", "password", "confirmPassword", "businessName", "address"]), successStatus: 201, successSchema: json({ ok: boolean, verificationStatus: string, requiresEmailConfirmation: boolean }), errors: [400, 409, 413, 429, 500, 503] }) },
  "/api/suppliers/dashboard": { get: operation({ tag: "Supplier", summary: "Dashboard Supplier", auth: "supplier", successSchema: json({ supplier: json({}, []), summary: json({}, []), recentBatches: arrayOf(ref("Batch")) }), errors: [401, 403, 500] }) },
  "/api/suppliers/batches": {
    get: operation({ tag: "Supplier", summary: "Daftar batch Supplier", auth: "supplier", parameters: [queryString("q"), queryString("status")], successSchema: json({ items: arrayOf(ref("Batch")), counts: json({}, []) }), errors: [401, 403, 500] }),
    post: operation({ tag: "Supplier", summary: "Buat batch Supplier", auth: "supplier", requestBody: multipartBody({ payload: { type: "string", description: "JSON katalog batch" }, action: { type: "string", enum: ["draft", "publish"] }, productPhoto: { type: "string", format: "binary" } }, ["payload"]), successStatus: 201, successSchema: json({ item: ref("Batch") }), errors: [400, 401, 403, 409, 500] }),
  },
  "/api/suppliers/batches/{id}": {
    get: operation({ tag: "Supplier", summary: "Detail batch Supplier", auth: "supplier", parameters: [id()], successSchema: json({ item: ref("Batch") }), errors: [400, 401, 403, 404, 500] }),
    patch: operation({ tag: "Supplier", summary: "Ubah batch Supplier", auth: "supplier", parameters: [id()], requestBody: multipartBody({ payload: { type: "string" }, action: { type: "string", enum: ["draft", "publish"] }, productPhoto: { type: "string", format: "binary" } }, ["payload"]), successSchema: json({ item: ref("Batch") }), errors: [400, 401, 403, 404, 409, 500] }),
    delete: operation({ tag: "Supplier", summary: "Hapus batch Supplier", auth: "supplier", parameters: [id()], errors: [400, 401, 403, 404, 409, 500] }),
  },
  "/api/suppliers/batches/{id}/cancel": { post: operation({ tag: "Supplier", summary: "Batalkan batch", auth: "supplier", parameters: [id()], requestBody: jsonBody({ reason: string }, ["reason"]), errors: [400, 401, 403, 404, 409, 500] }) },
  "/api/suppliers/batches/{id}/close": { post: operation({ tag: "Supplier", summary: "Tutup batch dan terbitkan invoice", auth: "supplierOrAdmin", parameters: [id()], successSchema: json({ ok: boolean, item: ref("Batch") }), errors: [400, 401, 403, 404, 409, 500] }) },
  "/api/suppliers/batches/{id}/orders": { get: operation({ tag: "Supplier", summary: "Daftar order dalam batch", auth: "supplierOrAdmin", parameters: [id(), queryString("status"), queryInt("limit"), queryString("cursor")], successSchema: json({ orders: arrayOf(ref("Order")), counts: json({}, []), nextCursor: { type: "string", nullable: true }, serverTime: { type: "string", format: "date-time" } }), errors: [400, 401, 403, 500] }) },
  "/api/suppliers/batches/{id}/ready": { post: operation({ tag: "Supplier", summary: "Tandai batch siap diambil", auth: "supplierOrAdmin", parameters: [id()], errors: [401, 403, 404, 409, 500] }) },
  "/api/suppliers/batches/{id}/transactions": { get: operation({ tag: "Supplier", summary: "Pusat transaksi batch", auth: "supplierOrAdmin", parameters: [id()], successSchema: json({ batch: ref("Batch"), summary: json({}, []), orders: arrayOf(ref("Order")), capabilities: json({}, []), serverTime: { type: "string", format: "date-time" } }), errors: [401, 403, 404, 409, 500, 503] }) },
  "/api/suppliers/finance": { get: operation({ tag: "Supplier", summary: "Saldo dan ledger Supplier", auth: "supplier", successSchema: ref("SupplierFinance"), errors: [401, 403, 500] }) },
  "/api/suppliers/finance/bank-account": { put: operation({ tag: "Supplier", summary: "Simpan rekening Supplier", auth: "supplier", requestBody: jsonBody({ id: uuid, bankName: string, accountNumber: string, accountHolderName: string, isPrimary: boolean }, ["bankName", "accountNumber", "accountHolderName"]), errors: [400, 401, 403, 404] }) },
  "/api/suppliers/finance/payouts": { post: operation({ tag: "Supplier", summary: "Ajukan payout Supplier", auth: "supplier", requestBody: jsonBody({ amount: integer, bankAccountId: uuid, idempotencyKey: string }, ["amount", "bankAccountId"]), successStatus: 201, successSchema: json({ ok: boolean, payoutId: uuid }), errors: [400, 401, 403, 409, 500] }) },
  "/api/suppliers/notifications": {
    get: operation({ tag: "Supplier", summary: "Daftar notifikasi Supplier", auth: "supplier", successSchema: json({ notifications: arrayOf(ref("Notification")) }), errors: [401, 403, 500] }),
    patch: operation({ tag: "Supplier", summary: "Tandai notifikasi Supplier terbaca", auth: "supplier", errors: [401, 403, 500] }),
  },

  "/api/umkm/dashboard": { get: operation({ tag: "UMKM", summary: "Dashboard UMKM", auth: "umkm", successSchema: json({ profileComplete: boolean, profile: json({}, []), activeOrderCount: integer, unreadNotificationCount: integer, nextAction: string }), errors: [401, 403, 500] }) },
  "/api/umkm/notifications": {
    get: operation({ tag: "UMKM", summary: "Daftar notifikasi UMKM", auth: "umkm", successSchema: json({ notifications: arrayOf(ref("Notification")) }), errors: [401, 403, 500] }),
    patch: operation({ tag: "UMKM", summary: "Tandai notifikasi UMKM terbaca", auth: "umkm", errors: [401, 403, 500] }),
  },
  "/api/umkm/orders": { get: operation({ tag: "UMKM", summary: "Daftar pesanan UMKM", auth: "umkm", parameters: [queryString("status"), queryString("cursor"), queryInt("limit")], successSchema: json({ orders: arrayOf(ref("Order")), items: arrayOf(ref("Order")), summary: json({}, []), counts: json({}, []), serverTime: { type: "string", format: "date-time" }, nextCursor: { type: "string", nullable: true } }), errors: [401, 403, 503] }) },
  "/api/umkm/orders/{orderId}": { get: operation({ tag: "UMKM", summary: "Detail pesanan UMKM", auth: "umkm", parameters: [id("orderId")], successSchema: ref("OrderDetail"), errors: [401, 403, 404, 500, 503] }) },
  "/api/umkm/orders/{orderId}/complaints": { post: operation({ tag: "UMKM", summary: "Ajukan komplain", auth: "umkm", parameters: [id("orderId")], requestBody: multipartBody({ category: { type: "string", enum: ["cacat", "busuk"] }, description: string, photos: arrayOf({ type: "string", format: "binary" }) }, ["category", "photos"]), successStatus: 201, successSchema: json({ ok: boolean, disputeId: uuid, photoUrls: arrayOf(string) }), errors: [400, 401, 403, 404, 409, 503] }) },
  "/api/umkm/orders/{orderId}/payment/charge": { post: operation({ tag: "UMKM", summary: "Buat atau gunakan kembali checkout Midtrans", auth: "umkm", parameters: [id("orderId")], successSchema: json({ attempt: ref("PaymentAttempt"), serverTime: { type: "string", format: "date-time" } }), errors: [401, 403, 404, 409, 429, 502, 503] }) },
  "/api/umkm/orders/{orderId}/payment/simulate-paid": { post: operation({ tag: "UMKM", summary: "Pelunasan demo sandbox (akun dan batch uji allowlist)", auth: "umkm", parameters: [id("orderId")], requestBody: jsonBody({checkoutReference:string}, ["checkoutReference"]), successSchema: json({simulated:boolean,duplicate:boolean,order:ref("OrderDetail")}), errors: [400,401,403,404,409,429,503] }) },
  "/api/umkm/orders/{orderId}/payment/reconcile": { post: operation({ tag: "UMKM", summary: "Rekonsiliasi status pembayaran", auth: "umkm", parameters: [id("orderId")], successSchema: json({ status: string, localStatus: string, transactionId: string, paymentType: string, reconciled: boolean, serverTime: { type: "string", format: "date-time" } }), errors: [401, 403, 404, 409, 429, 502, 503] }) },
  "/api/umkm/orders/{orderId}/ratings": { post: operation({ tag: "UMKM", summary: "Kirim rating order", auth: "umkm", parameters: [id("orderId")], requestBody: jsonBody({ score: { type: "integer", minimum: 1, maximum: 5 }, comment: string }, ["score"]), successStatus: 201, successSchema: json({ ok: boolean, ratingId: uuid }), errors: [400, 401, 403, 404, 409] }) },
  "/api/umkm/orders/{orderId}/refund-account": { put: operation({ tag: "UMKM", summary: "Simpan rekening refund", auth: "umkm", parameters: [id("orderId")], requestBody: jsonBody({ bankName: string, accountNumber: string, accountHolderName: string }, ["bankName", "accountNumber", "accountHolderName"]), errors: [400, 401, 403, 404, 409] }) },
  "/api/umkm/profile": {
    get: operation({ tag: "UMKM", summary: "Lihat profil UMKM", auth: "umkm", successSchema: json({ profile: json({}, []) }), errors: [401, 403, 500] }),
    put: operation({ tag: "UMKM", summary: "Perbarui profil UMKM", auth: "umkm", requestBody: jsonBody({ businessName: string, address: string, latitude: { type: "number" }, longitude: { type: "number" } }, ["businessName", "address"]), successSchema: json({ profile: json({}, []) }), errors: [400, 401, 403, 500] }),
  },
  "/api/webhook/midtrans": { post: operation({ tag: "Integrations", summary: "Terima notifikasi Midtrans", auth: "webhook", requestBody: jsonBody({ order_id: string, transaction_id: string, transaction_status: string, status_code: string, gross_amount: string, signature_key: string, merchant_id: string, fraud_status: string, payment_type: string }, ["order_id", "transaction_status", "status_code", "gross_amount", "signature_key"]), successSchema: json({ ok: boolean, processed: boolean, ignored: boolean, deduplicated: boolean }), errors: [400, 401, 503], description: "Signature SHA-512 Midtrans diverifikasi menggunakan server key; endpoint tidak menggunakan sesi pengguna." }) },
};

/** Pendaftaran ganda dijawab 409 dengan registration yang masih berlaku agar
 * UMKM dapat membatalkan lalu mendaftar ulang, bukan menganggap join kedua
 * sebagai pendaftaran baru. */
const registrationConflictSchema = json({
  error: string,
  code: { type: "string", enum: ["REGISTRATION_ALREADY_EXISTS", "BATCH_CAPACITY_EXCEEDED"] },
  details: json({
    registrationId: { type: "string", nullable: true },
    quantity: { type: "integer", nullable: true },
    canWithdraw: boolean,
  }, []),
}, ["error", "code", "details"]);

const registrationPost = paths["/api/registrations"]?.post;
if (registrationPost?.responses) {
  registrationPost.responses["409"] = response("Konflik pendaftaran: UMKM sudah terdaftar pada batch ini.", registrationConflictSchema);
}

export const openApiDocument: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "Wesup API",
    version: "0.1.0",
    description: "Dokumentasi API platform group-buying Wesup untuk UMKM, Supplier, Admin, dan integrasi Midtrans.",
  },
  servers: [{ url: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "/", description: "Wesup" }],
  tags: [
    { name: "Authentication", description: "Login, session, dan reset password" },
    { name: "Marketplace", description: "Pencarian dan detail batch" },
    { name: "Registrations", description: "Pendaftaran UMKM ke batch" },
    { name: "Batch", description: "Lifecycle batch" },
    { name: "Pickup", description: "QR/PIN dan konfirmasi pickup" },
    { name: "Supplier", description: "Katalog, transaksi, keuangan, dan notifikasi Supplier" },
    { name: "UMKM", description: "Dashboard, order, profil, pembayaran, komplain, rating, dan refund UMKM" },
    { name: "Admin", description: "Operasi administratif" },
    { name: "Integrations", description: "Webhook provider eksternal" },
  ],
  paths,
  components: {
    schemas,
    securitySchemes: {
      supabaseCookie: {
        type: "apiKey",
        in: "cookie",
        name: "sb-<project-ref>-auth-token",
        description: "Sesi cookie Supabase SSR. Nama cookie aktual mengikuti project Supabase.",
      },
    },
  },
};

export type WesupOpenApiDocument = typeof openApiDocument;
