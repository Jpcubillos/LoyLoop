import { NextResponse } from "next/server";
import { createClaimRequest, type ClaimAction } from "@/lib/claims";

function getErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : JSON.stringify(error);

  if (raw.includes("ENOTFOUND") || raw.includes("fetch failed")) {
    return "No se pudo conectar con Supabase. Revisa NEXT_PUBLIC_SUPABASE_URL en .env.local.";
  }

  return raw || "Could not create claim request.";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const actionType = body.actionType as ClaimAction;

    if (!actionType) {
      return NextResponse.json({ ok: false, message: "Missing actionType." }, { status: 400 });
    }

    const claim = await createClaimRequest({
      actionType,
      businessSlug: body.businessSlug ?? "cafe-central",
      payload: body.payload ?? {}
    });

    return NextResponse.json({
      ok: true,
      code: claim.code,
      expiresAt: claim.expires_at
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: getErrorMessage(error) }, { status: 500 });
  }
}
