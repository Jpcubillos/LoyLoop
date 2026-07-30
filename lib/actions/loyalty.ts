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

export async function createReward(formData: FormData) {
  try {
    const business = await getBusiness();
    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "product");
    const points = Number(formData.get("points_required") ?? 0);
    const creditAmount = Number(formData.get("credit_amount_cents") ?? 0);
    const description = String(formData.get("description") ?? "").trim();
    const audienceSegment = String(formData.get("audience_segment") ?? "active");

    if (!name) return;

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
    logDemoBackendWarning("createReward", error);
  }
}

export async function updateReward(formData: FormData) {
  try {
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "product");
    const points = Number(formData.get("points_required") ?? 0);
    const creditAmount = Number(formData.get("credit_amount_cents") ?? 0);
    const description = String(formData.get("description") ?? "").trim();
    const audienceSegment = String(formData.get("audience_segment") ?? "active");

    if (!id || !name) return;

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
    logDemoBackendWarning("updateReward", error);
  }
}

export async function deleteReward(formData: FormData) {
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const { error } = await db.from("rewards").delete().eq("id", id);

    if (error) throw error;
    revalidatePath("/dashboard/recompensas");
    revalidatePath("/c/cafe-central");
    revalidatePath("/c/recompensas");
  } catch (error) {
    logDemoBackendWarning("deleteReward", error);
  }
}

export async function createMission(formData: FormData) {
  try {
    const business = await getBusiness();
    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "frequency");
    const goal = Number(formData.get("goal") ?? 1);
    const rewardPoints = Number(formData.get("reward_points") ?? 0);
    const description = String(formData.get("description") ?? "").trim();
    const audienceSegment = String(formData.get("audience_segment") ?? "active");
    const schedule = getSchedule(formData);

    if (!name) return;

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
    logDemoBackendWarning("createMission", error);
  }
}

export async function updateMission(formData: FormData) {
  try {
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "frequency");
    const goal = Number(formData.get("goal") ?? 1);
    const rewardPoints = Number(formData.get("reward_points") ?? 0);
    const description = String(formData.get("description") ?? "").trim();
    const audienceSegment = String(formData.get("audience_segment") ?? "active");
    const schedule = getSchedule(formData);

    if (!id || !name) return;

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
    logDemoBackendWarning("updateMission", error);
  }
}

export async function createCampaign(formData: FormData) {
  try {
    const business = await getBusiness();
    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "discount_redeem");
    const description = String(formData.get("description") ?? "").trim();
    const discountPercent = Number(formData.get("discount_percent") ?? 0);
    const rewardPoints = Number(formData.get("reward_points") ?? 0);
    const audienceSegment = String(formData.get("audience_segment") ?? "active");
    const schedule = getSchedule(formData);

    if (!name) return;

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
    logDemoBackendWarning("createCampaign", error);
  }
}

export async function updateCampaign(formData: FormData) {
  try {
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "discount_redeem");
    const description = String(formData.get("description") ?? "").trim();
    const discountPercent = Number(formData.get("discount_percent") ?? 0);
    const rewardPoints = Number(formData.get("reward_points") ?? 0);
    const audienceSegment = String(formData.get("audience_segment") ?? "active");
    const schedule = getSchedule(formData);

    if (!id || !name) return;

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
    logDemoBackendWarning("updateCampaign", error);
  }
}

export async function deleteMission(formData: FormData) {
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const { error } = await db.from("missions").delete().eq("id", id);

    if (error) throw error;
    revalidatePath("/dashboard/misiones");
    revalidatePath("/c/cafe-central");
  } catch (error) {
    logDemoBackendWarning("deleteMission", error);
  }
}

export async function deleteCampaign(formData: FormData) {
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const { error } = await db.from("campaigns").delete().eq("id", id);

    if (error) throw error;
    revalidatePath("/dashboard/campanas");
    revalidatePath("/c/cafe-central");
  } catch (error) {
    logDemoBackendWarning("deleteCampaign", error);
  }
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
