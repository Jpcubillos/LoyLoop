import { supabase } from "@/lib/supabase/client";

const db = supabase as any;

export type CafeCentralCustomerState = {
  points: number;
  creditCents: number;
  tier: string;
  currentStamps: number;
  requiredStamps: number;
  availableCampaigns: Array<{
    id: string;
    name: string;
    type: "discount_redeem" | "points_boost";
    description: string;
    discountPercent: number | null;
    rewardPoints: number;
  }>;
  availableRewards: Array<{
    id: string;
    name: string;
    type: "discount" | "points" | "credit" | "product";
    description: string;
    pointsRequired: number | null;
    creditAmountCents: number | null;
  }>;
  availableMissions: Array<{
    id: string;
    name: string;
    category: "frequency" | "referral" | "offpeak" | "minipay" | "review";
    description: string;
    goal: number;
    progress: number;
    rewardPoints: number;
  }>;
  history: Array<[string, string, string]>;
};

function formatEventValue(points: number, creditCents: number) {
  if (creditCents > 0) return `$${Math.round(creditCents / 100).toLocaleString("es-CO")}`;
  if (points > 0) return `+${points} pts`;
  if (points < 0) return `${points} pts`;
  return "";
}

export async function getCafeCentralCustomerState(): Promise<CafeCentralCustomerState> {
  const fallback: CafeCentralCustomerState = {
    points: 120,
    creditCents: 500000,
    tier: "Cliente frecuente",
    currentStamps: 6,
    requiredStamps: 10,
    availableCampaigns: [
      {
        id: "demo-discount",
        name: "15% de descuento",
        type: "discount_redeem",
        description: "Disponible en tu proxima visita",
        discountPercent: 15,
        rewardPoints: 0
      },
      {
        id: "demo-points",
        name: "Puntos dobles",
        type: "points_boost",
        description: "Hoy de 3 p.m. a 5 p.m.",
        discountPercent: null,
        rewardPoints: 20
      }
    ],
    availableRewards: [
      {
        id: "demo-reward-stamps",
        name: "Cafe gratis con 10 sellos",
        type: "product",
        description: "Completa 10 compras registradas y reclama un cafe gratis.",
        pointsRequired: null,
        creditAmountCents: null
      },
      {
        id: "demo-reward-discount",
        name: "15% de descuento",
        type: "discount",
        description: "Disponible en tu proxima visita.",
        pointsRequired: 200,
        creditAmountCents: null
      }
    ],
    availableMissions: [
      {
        id: "demo-frequency",
        name: "Compra 2 veces esta semana",
        category: "frequency",
        description: "1/2 completado",
        goal: 2,
        progress: 50,
        rewardPoints: 50
      },
      {
        id: "demo-minipay",
        name: "Paga con MiniPay",
        category: "minipay",
        description: "0/1 completado",
        goal: 1,
        progress: 0,
        rewardPoints: 30
      }
    ],
    history: [
      ["Hoy", "Te uniste al club", "+20 pts"],
      ["Hoy", "Credito de bienvenida", "$5.000"],
      ["Ayer", "Compra registrada", "+15 pts"]
    ]
  };

  const { data: business, error: businessError } = await db
    .from("businesses")
    .select("id")
    .eq("slug", "cafe-central")
    .maybeSingle();

  if (businessError || !business) return fallback;

  const { data: customer, error: customerError } = await db
    .from("customer_profiles")
    .select("id")
    .eq("email", "juan@loyloop.app")
    .maybeSingle();

  if (customerError || !customer) return fallback;

  const { data: membership } = await db
    .from("business_memberships")
    .select("points_balance, credit_balance_cents, tier")
    .eq("business_id", business.id)
    .eq("customer_id", customer.id)
    .maybeSingle();

  const { data: stampCard } = await db
    .from("stamp_cards")
    .select("current_stamps, required_stamps")
    .eq("business_id", business.id)
    .eq("customer_id", customer.id)
    .eq("reward_name", "Cafe gratis con 10 sellos")
    .maybeSingle();

  const { data: events } = await db
    .from("loyalty_events")
    .select("event_type, points_delta, credit_delta_cents, metadata, created_at")
    .eq("business_id", business.id)
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(3);

  const customerSegment = membership?.tier?.toLowerCase().includes("vip") ? "vip" : "active";
  const now = Date.now();

  const { data: campaigns, error: campaignsError } = await db
    .from("campaigns")
    .select("id, name, type, description, discount_percent, reward_points, audience_segment, duration_type, starts_at, ends_at")
    .eq("business_id", business.id)
    .eq("active", true)
    .in("status", ["active", "scheduled"])
    .order("created_at", { ascending: false });

  const campaignIds = campaigns?.map((campaign: any) => campaign.id) ?? [];
  const { data: redemptions } = campaignIds.length
    ? await db
        .from("campaign_redemptions")
        .select("campaign_id")
        .eq("customer_id", customer.id)
        .in("campaign_id", campaignIds)
    : { data: [] };

  const redeemedCampaignIds = new Set(redemptions?.map((item: any) => item.campaign_id) ?? []);
  const availableCampaigns = campaignsError
    ? fallback.availableCampaigns
    : (campaigns ?? [])
        .filter((campaign: any) => campaign.audience_segment === customerSegment)
        .filter((campaign: any) => {
          if (campaign.duration_type === "indefinite") return true;
          const startsAt = campaign.starts_at ? new Date(campaign.starts_at).getTime() : 0;
          const endsAt = campaign.ends_at ? new Date(campaign.ends_at).getTime() : Number.POSITIVE_INFINITY;
          return startsAt <= now && endsAt >= now;
        })
        .filter((campaign: any) => !redeemedCampaignIds.has(campaign.id))
        .map((campaign: any) => ({
          id: campaign.id,
          name: campaign.name,
          type: campaign.type,
          description: campaign.description ?? "Campana disponible",
          discountPercent: campaign.discount_percent,
          rewardPoints: campaign.reward_points ?? 0
        }));

  const { data: missions, error: missionsError } = await db
    .from("missions")
    .select("id, name, category, description, goal, reward_points, audience_segment, duration_type, starts_at, ends_at")
    .eq("business_id", business.id)
    .eq("active", true)
    .order("created_at", { ascending: false });

  const availableMissions = missionsError
    ? fallback.availableMissions
    : (missions ?? [])
        .filter((mission: any) => mission.audience_segment === customerSegment)
        .filter((mission: any) => {
          if (mission.duration_type === "indefinite") return true;
          const startsAt = mission.starts_at ? new Date(mission.starts_at).getTime() : 0;
          const endsAt = mission.ends_at ? new Date(mission.ends_at).getTime() : Number.POSITIVE_INFINITY;
          return startsAt <= now && endsAt >= now;
        })
        .map((mission: any) => {
          const goal = mission.goal ?? 1;
          const progress = mission.category === "frequency" ? Math.min(50, 100 / goal) : 0;

          return {
            id: mission.id,
            name: mission.name,
            category: mission.category,
            description: progress > 0 ? `1/${goal} completado` : `0/${goal} completado`,
            goal,
            progress,
            rewardPoints: mission.reward_points ?? 0
          };
        });

  const { data: rewards, error: rewardsError } = await db
    .from("rewards")
    .select("id, name, type, description, points_required, credit_amount_cents")
    .eq("business_id", business.id)
    .eq("active", true)
    .order("created_at", { ascending: false });

  const availableRewards = rewardsError
    ? fallback.availableRewards
    : (rewards ?? []).map((reward: any) => ({
        id: reward.id,
        name: reward.name,
        type: reward.type,
        description: reward.description ?? "Beneficio disponible en este comercio.",
        pointsRequired: reward.points_required,
        creditAmountCents: reward.credit_amount_cents
      }));

  return {
    points: membership?.points_balance ?? fallback.points,
    creditCents: membership?.credit_balance_cents ?? fallback.creditCents,
    tier: membership?.tier ?? fallback.tier,
    currentStamps: stampCard?.current_stamps ?? fallback.currentStamps,
    requiredStamps: stampCard?.required_stamps ?? fallback.requiredStamps,
    availableCampaigns,
    availableRewards,
    availableMissions,
    history: events?.length
      ? events.map((event: any) => [
          "Reciente",
          event.metadata?.label ?? event.event_type,
          formatEventValue(event.points_delta, event.credit_delta_cents)
        ])
      : fallback.history
  };
}
