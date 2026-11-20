"use server";
import { backendBusiness, backendRequest } from "@/lib/backend/server";
import { writeOffer } from "@/lib/backend/offers";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const db = supabase as any;



function logDemoBackendWarning(action: string, _error: unknown) { console.error(`[LoyLoop] ${action} failed`); }



async function getBusiness() { return backendBusiness(); }

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

    const { error } = await (writeOffer("rewards", "POST", {
      business_id: business.id,
      name,
      type,
      description,
      points_required: points > 0 ? points : null,
      credit_amount_cents: type === "credit" && creditAmount > 0 ? creditAmount : null,
      audience_segment: audienceSegment,
      active: true
    }));

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

    const { error } = await (writeOffer("rewards", "PATCH", {
        name,
        type,
        description,
        points_required: points > 0 ? points : null,
        credit_amount_cents: type === "credit" && creditAmount > 0 ? creditAmount : null,
        audience_segment: audienceSegment
      }, id));

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

    const { error } = await (writeOffer("rewards", "DELETE", {}, id));

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

    const { error } = await (writeOffer("missions", "POST", {
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
    }));

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

    const { error } = await (writeOffer("missions", "PATCH", {
        name,
        category,
        description,
        goal: goal > 0 ? goal : 1,
        reward_points: rewardPoints > 0 ? rewardPoints : 0,
        audience_segment: audienceSegment,
        duration_type: schedule.durationType,
        starts_at: schedule.startsAt,
        ends_at: schedule.endsAt
      }, id));

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

    const { error } = await (writeOffer("campaigns", "POST", {
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
    }));

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

    const { error } = await (writeOffer("campaigns", "PATCH", {
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
      }, id));

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

    const { error } = await (writeOffer("missions", "DELETE", {}, id));

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

    const { error } = await (writeOffer("campaigns", "DELETE", {}, id));

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
  const {data,error}=await db.from("businesses").select("id").eq("slug",slug).single();
  if(error || !data) throw new Error("No encontramos el comercio.");
  await backendRequest(`/memberships/${data.id}/`,"POST",{});
  revalidatePath("/c");revalidatePath(`/c/${slug}`);
}

export async function joinBusinessAction(_formData: FormData) {
  await joinBusiness("cafe-central");
}

export async function addDemoStamp(_slug = "cafe-central") { throw new Error("Genera el QR y pide su validacion al comercio."); }

export async function addDemoStampAction(_formData: FormData) {
  await addDemoStamp("cafe-central");
}

export async function redeemStampReward(_slug = "cafe-central") { throw new Error("Genera el QR y pide su validacion al comercio."); }

export async function redeemStampRewardAction(_formData: FormData) {
  await redeemStampReward("cafe-central");
}
