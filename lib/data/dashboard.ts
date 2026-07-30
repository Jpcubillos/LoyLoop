import { supabase } from "@/lib/supabase/client";
import {
  campaigns as fallbackCampaigns,
  rewards as fallbackRewards,
  missions as fallbackMissions
} from "@/lib/dashboard-data";

const db = supabase as any;

export type DashboardReward = {
  id: string;
  name: string;
  type: string;
  typeValue: string;
  description: string;
  requirement: string;
  audience: string;
  audienceSegment: string;
  pointsRequired: number;
  creditAmountCents: number;
  redeemed: number;
  active: boolean;
};

export type DashboardMission = {
  id: string;
  name: string;
  category: string;
  categoryValue: string;
  description: string;
  audience: string;
  audienceSegment: string;
  schedule: string;
  durationType: string;
  startsAtInput: string;
  endsAtInput: string;
  progress: number;
  goal: number;
  reward: string;
  rewardPoints: number;
  active: boolean;
};

export type DashboardCampaign = {
  id: string;
  name: string;
  type: string;
  typeValue: string;
  description: string;
  audience: string;
  audienceSegment: string;
  schedule: string;
  durationType: string;
  startsAtInput: string;
  endsAtInput: string;
  discountPercent: number;
  rewardPoints: number;
  status: string;
  tone: "green" | "blue" | "slate";
  reach: string;
  redemptions: string;
};

export type BusinessSettings = {
  vipPurchaseThreshold: number;
  atRiskDays: number;
  inactiveDays: number;
};

export async function getCafeCentral() {
  const { data, error } = await db
    .from("businesses")
    .select("*")
    .eq("slug", "cafe-central")
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const business = await getCafeCentral();

  return {
    vipPurchaseThreshold: business?.vip_purchase_threshold ?? 30,
    atRiskDays: business?.at_risk_days ?? 90,
    inactiveDays: business?.inactive_days ?? 180
  };
}

function getFallbackCampaigns(): DashboardCampaign[] {
  return fallbackCampaigns.map((campaign) => ({
    id: campaign.name,
    name: campaign.name,
    type: "Campana",
    typeValue: "discount_redeem",
    description: "Campana demo lista para validar con QR.",
    audience: "Activo",
    audienceSegment: "active",
    schedule: "Tiempo indefinido",
    durationType: "indefinite",
    startsAtInput: "",
    endsAtInput: "",
    discountPercent: 15,
    rewardPoints: 0,
    status: campaign.status,
    tone: campaign.tone === "green" || campaign.tone === "blue" ? campaign.tone : "slate",
    reach: String(campaign.reach),
    redemptions: String(campaign.redemptions)
  }));
}

function getFallbackRewards(): DashboardReward[] {
  return fallbackRewards.map((reward) => ({
    id: reward.name,
    name: reward.name,
    type: reward.type,
    typeValue: reward.type.toLowerCase().includes("descuento")
      ? "discount"
      : reward.type.toLowerCase().includes("credito")
        ? "credit"
        : reward.type.toLowerCase().includes("puntos")
          ? "points"
          : "product",
    description: reward.requirement,
    requirement: reward.requirement,
    audience: "Activo",
    audienceSegment: "active",
    pointsRequired: reward.requirement.includes("200") ? 200 : 0,
    creditAmountCents: reward.name.includes("$5.000") ? 500000 : 0,
    redeemed: reward.redeemed,
    active: reward.active
  }));
}

function getSegmentLabel(segment?: string) {
  const labels: Record<string, string> = {
    inactive: "Inactivo",
    at_risk: "En riesgo",
    active: "Activo",
    vip: "VIP"
  };

  return labels[segment ?? "active"] ?? "Activo";
}

function getScheduleLabel(durationType?: string, startsAt?: string | null, endsAt?: string | null) {
  if (durationType === "one_hour") return "1 hora";
  if (durationType === "custom") {
    const start = startsAt ? new Date(startsAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "ahora";
    const end = endsAt ? new Date(endsAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "sin cierre";
    return `${start} - ${end}`;
  }

  return "Tiempo indefinido";
}

function toDateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

export async function getDashboardRewards(): Promise<DashboardReward[]> {
  const business = await getCafeCentral();
  if (!business) return getFallbackRewards();

  const { data, error } = await db
    .from("rewards")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  if (error || !data.length) return getFallbackRewards();

  return data.map((reward: any) => ({
    id: reward.id,
    name: reward.name,
    type: reward.type === "product" ? "Producto gratis" : reward.type === "discount" ? "Descuento" : reward.type === "credit" ? "Credito" : "Puntos",
    typeValue: reward.type,
    description: reward.description ?? "Beneficio disponible en este comercio.",
    requirement: reward.points_required ? `${reward.points_required} puntos` : reward.description ?? "Sin condicion",
    audience: getSegmentLabel(reward.audience_segment),
    audienceSegment: reward.audience_segment ?? "active",
    pointsRequired: reward.points_required ?? 0,
    creditAmountCents: reward.credit_amount_cents ?? 0,
    redeemed: 0,
    active: reward.active
  }));
}

export async function getDashboardMissions(): Promise<DashboardMission[]> {
  const business = await getCafeCentral();
  if (!business) {
    return fallbackMissions.map((mission) => ({
      ...mission,
      id: mission.name,
      categoryValue: "frequency",
      description: "Mision demo",
      audience: "Activo",
      audienceSegment: "active",
      schedule: "Tiempo indefinido",
      durationType: "indefinite",
      startsAtInput: "",
      endsAtInput: "",
      goal: 1,
      rewardPoints: 30
    }));
  }

  const { data, error } = await db
    .from("missions")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  if (error || !data.length) {
    return fallbackMissions.map((mission) => ({
      ...mission,
      id: mission.name,
      categoryValue: "frequency",
      description: "Mision demo",
      audience: "Activo",
      audienceSegment: "active",
      schedule: "Tiempo indefinido",
      durationType: "indefinite",
      startsAtInput: "",
      endsAtInput: "",
      goal: 1,
      rewardPoints: 30
    }));
  }

  return data.map((mission: any) => ({
    id: mission.id,
    name: mission.name,
    category: mission.category,
    categoryValue: mission.category,
    description: mission.description ?? "Sin descripcion",
    audience: getSegmentLabel(mission.audience_segment),
    audienceSegment: mission.audience_segment ?? "active",
    schedule: getScheduleLabel(mission.duration_type, mission.starts_at, mission.ends_at),
    durationType: mission.duration_type ?? "indefinite",
    startsAtInput: toDateTimeInput(mission.starts_at),
    endsAtInput: toDateTimeInput(mission.ends_at),
    progress: 0,
    goal: mission.goal ?? 1,
    reward: `+${mission.reward_points} puntos`,
    rewardPoints: mission.reward_points ?? 0,
    active: mission.active
  }));
}

export async function getDashboardCampaigns(): Promise<DashboardCampaign[]> {
  const business = await getCafeCentral();
  if (!business) return getFallbackCampaigns();

  const { data, error } = await db
    .from("campaigns")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  if (error || !data.length) return getFallbackCampaigns();

  const campaignIds = data.map((campaign: any) => campaign.id);
  const { data: redemptions } = await db
    .from("campaign_redemptions")
    .select("campaign_id")
    .in("campaign_id", campaignIds);

  return data.map((campaign: any) => {
    const redemptionCount = redemptions?.filter((item: any) => item.campaign_id === campaign.id).length ?? 0;
    const isPoints = campaign.type === "points_boost";

    return {
      id: campaign.id,
      name: campaign.name,
      type: isPoints ? "Puntos" : "Descuento",
      typeValue: campaign.type,
      description: campaign.description ?? "Campana activa",
      audience: getSegmentLabel(campaign.audience_segment),
      audienceSegment: campaign.audience_segment ?? "active",
      schedule: getScheduleLabel(campaign.duration_type, campaign.starts_at, campaign.ends_at),
      durationType: campaign.duration_type ?? "indefinite",
      startsAtInput: toDateTimeInput(campaign.starts_at),
      endsAtInput: toDateTimeInput(campaign.ends_at),
      discountPercent: campaign.discount_percent ?? 0,
      rewardPoints: campaign.reward_points ?? 0,
      status: campaign.status === "active" ? "Activa" : campaign.status === "scheduled" ? "Programada" : "Finalizada",
      tone: campaign.status === "active" ? "green" : campaign.status === "scheduled" ? "blue" : "slate",
      reach: "Demo",
      redemptions: String(redemptionCount)
    };
  });
}
