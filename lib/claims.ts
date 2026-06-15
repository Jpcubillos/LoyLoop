import { supabase } from "@/lib/supabase/client";

const db = supabase as any;

export type ClaimAction = "stamp_add" | "stamp_redeem" | "discount_redeem" | "points_boost";

function generateClaimCode(actionType: ClaimAction) {
  const prefix = actionType.toUpperCase().replace("_", "-");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${random}`;
}

export async function getDemoBusinessAndCustomer(slug = "cafe-central") {
  const { data: business, error: businessError } = await db
    .from("businesses")
    .select("*")
    .eq("slug", slug)
    .single();

  if (businessError) throw businessError;

  const { data: customer, error: customerError } = await db
    .from("customer_profiles")
    .select("*")
    .eq("email", "juan@loyloop.app")
    .single();

  if (customerError) throw customerError;

  return { business, customer };
}

export async function createClaimRequest({
  actionType,
  businessSlug = "cafe-central",
  payload = {}
}: {
  actionType: ClaimAction;
  businessSlug?: string;
  payload?: Record<string, unknown>;
}) {
  const { business, customer } = await getDemoBusinessAndCustomer(businessSlug);
  const code = generateClaimCode(actionType);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("claim_requests")
    .insert({
      code,
      business_id: business.id,
      customer_id: customer.id,
      action_type: actionType,
      status: "pending",
      payload,
      expires_at: expiresAt
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function addStamp(claim: any) {
  const { data: card, error } = await db
    .from("stamp_cards")
    .select("*")
    .eq("business_id", claim.business_id)
    .eq("customer_id", claim.customer_id)
    .eq("reward_name", "Cafe gratis con 10 sellos")
    .single();

  if (error) throw error;

  if (card.current_stamps >= card.required_stamps) {
    return { ok: false, message: "El cliente ya llego al maximo de sellos." };
  }

  const nextStamps = card.current_stamps + 1;

  const { error: updateError } = await db
    .from("stamp_cards")
    .update({ current_stamps: nextStamps })
    .eq("id", card.id);

  if (updateError) throw updateError;

  await db.from("loyalty_events").insert({
    business_id: claim.business_id,
    customer_id: claim.customer_id,
    event_type: "stamp",
    points_delta: 10,
    metadata: { label: "Sello agregado por validacion QR" }
  });

  return { ok: true, message: `Sello agregado. Ahora tiene ${nextStamps}/${card.required_stamps}.` };
}

async function redeemStamp(claim: any) {
  const { data: card, error } = await db
    .from("stamp_cards")
    .select("*")
    .eq("business_id", claim.business_id)
    .eq("customer_id", claim.customer_id)
    .eq("reward_name", "Cafe gratis con 10 sellos")
    .single();

  if (error) throw error;

  if (card.current_stamps < card.required_stamps) {
    return { ok: false, message: "El cliente aun no completa los sellos requeridos." };
  }

  const { error: updateError } = await db
    .from("stamp_cards")
    .update({ current_stamps: 0 })
    .eq("id", card.id);

  if (updateError) throw updateError;

  await db.from("loyalty_events").insert({
    business_id: claim.business_id,
    customer_id: claim.customer_id,
    event_type: "reward_redeem",
    metadata: { label: "Cafe gratis redimido por validacion QR" }
  });

  return { ok: true, message: "Recompensa redimida. La tarjeta vuelve a 0 sellos." };
}

async function recordCampaignRedemption(claim: any) {
  const campaignId = claim.payload?.campaignId;
  if (!campaignId || typeof campaignId !== "string") return;

  await db.from("campaign_redemptions").upsert({
    campaign_id: campaignId,
    business_id: claim.business_id,
    customer_id: claim.customer_id,
    claim_request_id: claim.id
  }, { onConflict: "campaign_id,customer_id" });
}

async function redeemDiscount(claim: any) {
  const campaignName = claim.payload?.campaignName ?? "Descuento";
  const discountPercent = claim.payload?.discountPercent;

  await db.from("loyalty_events").insert({
    business_id: claim.business_id,
    customer_id: claim.customer_id,
    event_type: "reward_redeem",
    metadata: {
      label: `${campaignName} validado por QR`,
      campaign_id: claim.payload?.campaignId,
      discount_percent: discountPercent
    }
  });

  await recordCampaignRedemption(claim);

  return { ok: true, message: "Campana de descuento validada correctamente." };
}

async function activatePointsBoost(claim: any) {
  const rewardPoints = Number(claim.payload?.rewardPoints ?? 20);
  const { data: membership } = await db
    .from("business_memberships")
    .select("points_balance")
    .eq("business_id", claim.business_id)
    .eq("customer_id", claim.customer_id)
    .single();

  const nextPoints = (membership?.points_balance ?? 0) + rewardPoints;

  await db
    .from("business_memberships")
    .update({ points_balance: nextPoints })
    .eq("business_id", claim.business_id)
    .eq("customer_id", claim.customer_id);

  await db.from("loyalty_events").insert({
    business_id: claim.business_id,
    customer_id: claim.customer_id,
    event_type: "mission_progress",
    points_delta: rewardPoints,
    metadata: {
      label: `${claim.payload?.campaignName ?? "Puntos extra"} validado por QR`,
      campaign_id: claim.payload?.campaignId
    }
  });

  await recordCampaignRedemption(claim);

  return { ok: true, message: `Campana validada. Se sumaron ${rewardPoints} puntos.` };
}

export async function validateClaimRequest(code: string, businessSlug = "cafe-central") {
  const normalizedCode = code.trim().toUpperCase();
  const { business } = await getDemoBusinessAndCustomer(businessSlug);

  const { data: claim, error } = await db
    .from("claim_requests")
    .select("*")
    .eq("code", normalizedCode)
    .single();

  if (error || !claim) {
    return { ok: false, message: "QR no encontrado." };
  }

  if (claim.business_id !== business.id) {
    return { ok: false, message: "Este QR pertenece a otro comercio." };
  }

  if (claim.status !== "pending") {
    return { ok: false, message: `Este QR ya fue ${claim.status}.` };
  }

  if (new Date(claim.expires_at).getTime() < Date.now()) {
    await db.from("claim_requests").update({ status: "expired" }).eq("id", claim.id);
    return { ok: false, message: "Este QR expiro. Pidele al cliente generar otro." };
  }

  const result =
    claim.action_type === "stamp_add"
      ? await addStamp(claim)
      : claim.action_type === "stamp_redeem"
        ? await redeemStamp(claim)
        : claim.action_type === "discount_redeem"
          ? await redeemDiscount(claim)
          : await activatePointsBoost(claim);

  await db
    .from("claim_requests")
    .update({
      status: result.ok ? "approved" : "rejected",
      approved_at: result.ok ? new Date().toISOString() : null
    })
    .eq("id", claim.id);

  return result;
}
