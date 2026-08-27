import { NextResponse } from "next/server";
import { validateClaimRequest } from "@/lib/claims";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = String(body.code ?? "");

    if (!code.trim()) {
      return NextResponse.json(
        { ok: false, message: "Ingresa un codigo." },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await validateClaimRequest(code, body.businessSlug ?? "cafe-central");
    return NextResponse.json(result, {
      status: result.ok ? 200 : 400,
      headers: corsHeaders
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo validar el QR.";
    return NextResponse.json(
      { ok: false, message },
      { status: 500, headers: corsHeaders }
    );
  }
}
