import { POST as handleSupplierRegister } from "@/app/api/auth/register/supplier/route";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handleSupplierRegister(request);
}
