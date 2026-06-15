import { NextResponse } from "next/server";
import { validateClaimRequest } from "@/lib/claims";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = String(body.code ?? "");

    if (!code.trim()) {
      return NextResponse.json({ ok: false, message: "Ingresa un codigo." }, { status: 400 });
    }

    const result = await validateClaimRequest(code, body.businessSlug ?? "cafe-central");
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo validar el QR.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
