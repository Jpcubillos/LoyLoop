import { NextResponse } from "next/server";
import { createClaimRequest, type ClaimAction } from "@/lib/claims";

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
    const message = error instanceof Error ? error.message : "Could not create claim request.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
