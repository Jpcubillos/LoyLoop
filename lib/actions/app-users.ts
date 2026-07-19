"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/client";

const db = supabase as any;

async function getBusiness(slug = "cafe-central") {
  const { data, error } = await db
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .single();

  if (error) throw error;
  return data;
}

export async function createBusinessUser(formData: FormData) {
  const business = await getBusiness();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const businessRole = String(formData.get("business_role") ?? "cashier");

  if (!fullName || !email) return;

  await db.from("app_users").upsert({
    email,
    full_name: fullName,
    account_type: "business",
    business_id: business.id,
    customer_id: null,
    business_role: businessRole,
    customer_segment: null,
    active: true
  }, { onConflict: "email" });

  revalidatePath("/dashboard/configuracion");
}

export async function updateAppUserRole(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const accountType = String(formData.get("account_type") ?? "customer");
  const businessRole = String(formData.get("business_role") ?? "");
  const active = formData.get("active") === "on";

  if (!id) return;

  await db
    .from("app_users")
    .update({
      account_type: accountType,
      business_role: accountType === "business" ? businessRole : null,
      customer_segment: null,
      active
    })
    .eq("id", id);

  revalidatePath("/dashboard/configuracion");
}

export async function updateBusinessSegmentationRules(formData: FormData) {
  const business = await getBusiness();
  const vipPurchaseThreshold = Number(formData.get("vip_purchase_threshold") ?? 30);
  const atRiskDays = Number(formData.get("at_risk_days") ?? 90);
  const inactiveDays = Number(formData.get("inactive_days") ?? 180);

  const safeVipThreshold = Math.max(1, Math.floor(vipPurchaseThreshold || 30));
  const safeAtRiskDays = Math.max(1, Math.floor(atRiskDays || 90));
  const safeInactiveDays = Math.max(safeAtRiskDays + 1, Math.floor(inactiveDays || 180));

  await db
    .from("businesses")
    .update({
      vip_purchase_threshold: safeVipThreshold,
      at_risk_days: safeAtRiskDays,
      inactive_days: safeInactiveDays
    })
    .eq("id", business.id);

  revalidatePath("/dashboard/configuracion");
  revalidatePath("/c/cafe-central");
}
