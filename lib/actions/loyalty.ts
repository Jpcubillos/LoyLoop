"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const db = supabase as any;

function isMissingSchemaError(error: unknown) {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  return message.includes("PGRST205") || message.includes("Could not find the table");
}

function logDemoBackendWarning(action: string, error: unknown) {
  if (isMissingSchemaError(error)) {
    console.warn(`[LoyLoop demo] ${action} skipped because Supabase schema is not installed yet.`);
    return;
  }

  console.error(`[LoyLoop demo] ${action} failed`, error);
}

async function getOrCreateDemoCustomer() {
  const email = "juan@loyloop.app";
  const existing = await db
    .from("customer_profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (existing.data) return existing.data;

  const { data, error } = await db
    .from("customer_profiles")
    .insert({
      full_name: "Juan Perez",
      phone: "+573001234567",
      email
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function getBusiness(slug = "cafe-central") {
  const { data, error } = await db
    .from("businesses")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) throw error;
  return data;
}

function readNonNegativeInteger(formData: FormData, field: string, fallback = 0, minimum = 0) {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error("Revisa los valores numéricos del formulario.");
  }
  return value;
}

function getSchedule(formData: FormData) {
  const durationType = String(formData.get("duration_type") ?? "indefinite");
  const startValue = String(formData.get("starts_at") ?? "");
  const endValue = String(formData.get("ends_at") ?? "");
  const now = new Date();

  if (durationType === "one_hour") {
    return {
      durationType,
      startsAt: now.toISOString(),
      endsAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString()
    };
  }

  if (durationType === "custom") {
    return {
      durationType,
      startsAt: startValue ? new Date(startValue).toISOString() : now.toISOString(),
      endsAt: endValue ? new Date(endValue).toISOString() : null
    };
  }

  return {
    durationType: "indefinite",
    startsAt: null,
    endsAt: null
  };
}

async function persist_createReward(formData: FormData) {
  try {
    const business = await getBusiness();
    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "product");
    const points = readNonNegativeInteger(formData, "points_required");
    const creditAmount = readNonNegativeInteger(formData, "credit_amount_cents");
    const description = String(formData.get("description") ?? "").trim();
    const audienceSegment = String(formData.get("audience_segment") ?? "active");

    if (!name) throw new Error("El nombre es obligatorio.");

    const { error } = await db.from("rewards").insert({
      business_id: business.id,
      name,
      type,
      description,
      points_required: points > 0 ? points : null,
      credit_amount_cents: type === "credit" && creditAmount > 0 ? creditAmount : null,
      audience_segment: audienceSegment,
      active: true
    });

    if (error) throw error;
    revalidatePath("/dashboard/recompensas");
    revalidatePath("/c/cafe-central");
    revalidatePath("/c/recompensas");
  } catch (error) {
    throw error;
  }
}

async function persist_updateReward(formData: FormData) {
  try {
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "product");
    const points = readNonNegativeInteger(formData, "points_required");
    const creditAmount = readNonNegativeInteger(formData, "credit_amount_cents");
    const description = String(formData.get("description") ?? "").trim();
    const audienceSegment = String(formData.get("audience_segment") ?? "active");

    if (!id || !name) throw new Error("El nombre es obligatorio.");

    const { error } = await db
      .from("rewards")
      .update({
        name,
        type,
        description,
        points_required: points > 0 ? points : null,
        credit_amount_cents: type === "credit" && creditAmount > 0 ? creditAmount : null,
        audience_segment: audienceSegment
      })
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/dashboard/recompensas");
    revalidatePath("/c/cafe-central");
    revalidatePath("/c/recompensas");
  } catch (error) {
    throw error;
  }
}

async function persist_deleteReward(formData: FormData) {
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("No encontramos el registro.");

    const { error } = await db.from("rewards").delete().eq("id", id);

    if (error) throw error;
    revalidatePath("/dashboard/recompensas");
    revalidatePath("/c/cafe-central");
    revalidatePath("/c/recompensas");
  } catch (error) {
    throw error;
  }
}

async function persist_createMission(formData: FormData) {
  try {
    const business = await getBusiness();
    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "frequency");
    const goal = readNonNegativeInteger(formData, "goal", 1, 1);
    const rewardPoints = readNonNegativeInteger(formData, "reward_points");
    const description = String(formData.get("description") ?? "").trim();
    const audienceSegment = String(formData.get("audience_segment") ?? "active");
    const schedule = getSchedule(formData);

    if (!name) throw new Error("El nombre es obligatorio.");

    const { error } = await db.from("missions").insert({
      business_id: business.id,
      name,
      category,
      description,
      goal: goal > 0 ? goal : 1,
      reward_points: rewardPoints > 0 ? rewardPoints : 0,
      audience_segment: audienceSegment,
      duration_type: schedule.durationType,
      starts_at: schedule.startsAt,
      ends_at: schedule.endsAt,
      active: true
    });

    if (error) throw error;
    revalidatePath("/dashboard/misiones");
    revalidatePath("/c/cafe-central");
  } catch (error) {
    throw error;
  }
}

async function persist_updateMission(formData: FormData) {
  try {
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "frequency");
    const goal = readNonNegativeInteger(formData, "goal", 1, 1);
    const rewardPoints = readNonNegativeInteger(formData, "reward_points");
    const description = String(formData.get("description") ?? "").trim();
    const audienceSegment = String(formData.get("audience_segment") ?? "active");
    const schedule = getSchedule(formData);

    if (!id || !name) throw new Error("El nombre es obligatorio.");

    const { error } = await db
      .from("missions")
      .update({
        name,
        category,
        description,
        goal: goal > 0 ? goal : 1,
        reward_points: rewardPoints > 0 ? rewardPoints : 0,
        audience_segment: audienceSegment,
        duration_type: schedule.durationType,
        starts_at: schedule.startsAt,
        ends_at: schedule.endsAt
      })
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/dashboard/misiones");
    revalidatePath("/c/cafe-central");
  } catch (error) {
    throw error;
  }
}

async function persist_createCampaign(formData: FormData) {
  try {
    const business = await getBusiness();
    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "discount_redeem");
    const description = String(formData.get("description") ?? "").trim();
    const discountPercent = readNonNegativeInteger(formData, "discount_percent");
    const rewardPoints = readNonNegativeInteger(formData, "reward_points");
    const audienceSegment = String(formData.get("audience_segment") ?? "active");
    const schedule = getSchedule(formData);

    if (!name) throw new Error("El nombre es obligatorio.");
    if (type === "discount_redeem" && (discountPercent < 1 || discountPercent > 100)) {
      throw new Error("El descuento debe estar entre 1 y 100%. ");
    }
    if (type === "points_boost" && rewardPoints < 1) {
      throw new Error("La promoción debe entregar al menos 1 punto.");
    }

    const { error } = await db.from("campaigns").insert({
      business_id: business.id,
      name,
      type,
      description,
      discount_percent: type === "discount_redeem" && discountPercent > 0 ? discountPercent : null,
      reward_points: type === "points_boost" && rewardPoints > 0 ? rewardPoints : 0,
      audience_segment: audienceSegment,
      duration_type: schedule.durationType,
      starts_at: schedule.startsAt,
      ends_at: schedule.endsAt,
      status: schedule.startsAt && new Date(schedule.startsAt).getTime() > Date.now() ? "scheduled" : "active",
      active: true
    });

    if (error) throw error;
    revalidatePath("/dashboard/campanas");
    revalidatePath("/c/cafe-central");
  } catch (error) {
    throw error;
  }
}

async function persist_updateCampaign(formData: FormData) {
  try {
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "discount_redeem");
    const description = String(formData.get("description") ?? "").trim();
    const discountPercent = readNonNegativeInteger(formData, "discount_percent");
    const rewardPoints = readNonNegativeInteger(formData, "reward_points");
    const audienceSegment = String(formData.get("audience_segment") ?? "active");
    const schedule = getSchedule(formData);

    if (!id || !name) throw new Error("El nombre es obligatorio.");
    if (type === "discount_redeem" && (discountPercent < 1 || discountPercent > 100)) {
      throw new Error("El descuento debe estar entre 1 y 100%.");
    }
    if (type === "points_boost" && rewardPoints < 1) {
      throw new Error("La promoción debe entregar al menos 1 punto.");
    }

    const { error } = await db
      .from("campaigns")
      .update({
        name,
        type,
        description,
        discount_percent: type === "discount_redeem" && discountPercent > 0 ? discountPercent : null,
        reward_points: type === "points_boost" && rewardPoints > 0 ? rewardPoints : 0,
        audience_segment: audienceSegment,
        duration_type: schedule.durationType,
        starts_at: schedule.startsAt,
        ends_at: schedule.endsAt,
        status: schedule.startsAt && new Date(schedule.startsAt).getTime() > Date.now() ? "scheduled" : "active"
      })
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/dashboard/campanas");
    revalidatePath("/c/cafe-central");
  } catch (error) {
    throw error;
  }
}

async function persist_deleteMission(formData: FormData) {
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("No encontramos el registro.");

    const { error } = await db.from("missions").delete().eq("id", id);

    if (error) throw error;
    revalidatePath("/dashboard/misiones");
    revalidatePath("/c/cafe-central");
  } catch (error) {
    throw error;
  }
}

async function persist_deleteCampaign(formData: FormData) {
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("No encontramos el registro.");

    const { error } = await db.from("campaigns").delete().eq("id", id);

    if (error) throw error;
    revalidatePath("/dashboard/campanas");
    revalidatePath("/c/cafe-central");
  } catch (error) {
    throw error;
  }
}

async function finishMutation(action: string, route: string, mutate: () => Promise<void>) {
  let result = "success";
  try {
    await mutate();
  } catch (error) {
    logDemoBackendWarning(action, error);
    result = "error";
  }

  redirect(`${route}?result=${result}`);
}

export async function createReward(formData: FormData) {
  await finishMutation("createReward", "/dashboard/recompensas", () => persist_createReward(formData));
}
export async function updateReward(formData: FormData) {
  await finishMutation("updateReward", "/dashboard/recompensas", () => persist_updateReward(formData));
}
export async function deleteReward(formData: FormData) {
  await finishMutation("deleteReward", "/dashboard/recompensas", () => persist_deleteReward(formData));
}
export async function createMission(formData: FormData) {
  await finishMutation("createMission", "/dashboard/misiones", () => persist_createMission(formData));
}
export async function updateMission(formData: FormData) {
  await finishMutation("updateMission", "/dashboard/misiones", () => persist_updateMission(formData));
}
export async function deleteMission(formData: FormData) {
  await finishMutation("deleteMission", "/dashboard/misiones", () => persist_deleteMission(formData));
}
export async function createCampaign(formData: FormData) {
  await finishMutation("createCampaign", "/dashboard/campanas", () => persist_createCampaign(formData));
}
export async function updateCampaign(formData: FormData) {
  await finishMutation("updateCampaign", "/dashboard/campanas", () => persist_updateCampaign(formData));
}
export async function deleteCampaign(formData: FormData) {
  await finishMutation("deleteCampaign", "/dashboard/campanas", () => persist_deleteCampaign(formData));
}

export async function joinBusiness(slug = "cafe-central") {
  try {
    const business = await getBusiness(slug);
    const customer = await getOrCreateDemoCustomer();

    const { error: membershipError } = await db
      .from("business_memberships")
      .upsert({
        business_id: business.id,
        customer_id: customer.id,
        points_balance: 20,
        credit_balance_cents: 500000,
        tier: "Nuevo"
      }, { onConflict: "business_id,customer_id" });

    if (membershipError) throw membershipError;

    await db.from("stamp_cards").upsert({
      business_id: business.id,
      customer_id: customer.id,
      reward_name: "Cafe gratis con 10 sellos",
      current_stamps: 0,
      required_stamps: 10,
      active: true
    }, { onConflict: "business_id,customer_id,reward_name" });

    await db.from("loyalty_events").insert({
      business_id: business.id,
      customer_id: customer.id,
      event_type: "join",
      points_delta: 20,
      credit_delta_cents: 500000,
      metadata: { label: `Te uniste a ${business.name}` }
    });

    revalidatePath("/c");
    revalidatePath(`/c/${slug}`);
  } catch (error) {
    logDemoBackendWarning("joinBusiness", error);
  }
}

export async function joinBusinessAction(_formData: FormData) {
  await joinBusiness("cafe-central");
}

export async function addDemoStamp(slug = "cafe-central") {
  try {
    const business = await getBusiness(slug);
    const customer = await getOrCreateDemoCustomer();

    const { data: card } = await db
      .from("stamp_cards")
      .select("*")
      .eq("business_id", business.id)
      .eq("customer_id", customer.id)
      .eq("reward_name", "Cafe gratis con 10 sellos")
      .maybeSingle();

    const currentStamps = card?.current_stamps ?? 0;
    const requiredStamps = card?.required_stamps ?? 10;

    if (currentStamps >= requiredStamps) {
      revalidatePath("/c");
      revalidatePath(`/c/${slug}`);
      redirect(`/c/${slug}?stamp=max`);
    }

    const nextStamps = currentStamps + 1;

    await db.from("stamp_cards").upsert({
      business_id: business.id,
      customer_id: customer.id,
      reward_name: "Cafe gratis con 10 sellos",
      current_stamps: nextStamps,
      required_stamps: requiredStamps,
      active: true
    }, { onConflict: "business_id,customer_id,reward_name" });

    const { data: membership } = await db
      .from("business_memberships")
      .select("points_balance")
      .eq("business_id", business.id)
      .eq("customer_id", customer.id)
      .maybeSingle();

    await db
      .from("business_memberships")
      .upsert({
        business_id: business.id,
        customer_id: customer.id,
        points_balance: (membership?.points_balance ?? 0) + 10,
        credit_balance_cents: 500000,
        tier: "Cliente frecuente"
      }, { onConflict: "business_id,customer_id" });

    await db.from("loyalty_events").insert({
      business_id: business.id,
      customer_id: customer.id,
      event_type: "stamp",
      points_delta: 10,
      metadata: { label: "Sello agregado" }
    });

    revalidatePath("/c");
    revalidatePath(`/c/${slug}`);
  } catch (error) {
    logDemoBackendWarning("addDemoStamp", error);
  }
}

export async function addDemoStampAction(_formData: FormData) {
  await addDemoStamp("cafe-central");
}

export async function redeemStampReward(slug = "cafe-central") {
  try {
    const business = await getBusiness(slug);
    const customer = await getOrCreateDemoCustomer();

    const { data: card } = await db
      .from("stamp_cards")
      .select("current_stamps, required_stamps")
      .eq("business_id", business.id)
      .eq("customer_id", customer.id)
      .eq("reward_name", "Cafe gratis con 10 sellos")
      .maybeSingle();

    if (!card || card.current_stamps < card.required_stamps) {
      revalidatePath("/c");
      revalidatePath(`/c/${slug}`);
      return;
    }

    await db
      .from("stamp_cards")
      .update({ current_stamps: 0 })
      .eq("business_id", business.id)
      .eq("customer_id", customer.id)
      .eq("reward_name", "Cafe gratis con 10 sellos");

    await db.from("loyalty_events").insert({
      business_id: business.id,
      customer_id: customer.id,
      event_type: "reward_redeem",
      points_delta: 0,
      metadata: { label: "Cafe gratis redimido" }
    });

    revalidatePath("/c");
    revalidatePath(`/c/${slug}`);
  } catch (error) {
    logDemoBackendWarning("redeemStampReward", error);
  }
}

export async function redeemStampRewardAction(_formData: FormData) {
  await redeemStampReward("cafe-central");
}
