import { usesDjango, pageRequest as backendRequest } from "@/lib/backend/server";
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

function getDaysSince(dateValue?: string | null) {
  if (!dateValue) return Number.POSITIVE_INFINITY;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function deriveCustomerSegment({
  purchaseCount,
  lastVisitAt,
  vipPurchaseThreshold,
  atRiskDays,
  inactiveDays
}: {
  purchaseCount: number;
  lastVisitAt?: string | null;
  vipPurchaseThreshold: number;
  atRiskDays: number;
  inactiveDays: number;
}) {
  const daysSinceLastVisit = getDaysSince(lastVisitAt);

  if (daysSinceLastVisit >= inactiveDays) return "inactive";
  if (daysSinceLastVisit >= atRiskDays) return "at_risk";
  if (purchaseCount >= vipPurchaseThreshold) return "vip";
  return "active";
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

  if (usesDjango) {
    try {
      const data = await backendRequest<any>("/discovery/cafe-central/", "GET");
      if (data) {
        const stamps = data.stamps;
        const membership = data.membership;
        return {
          points: membership?.points_balance ?? 0,
          creditCents: membership?.credit_balance_cents ?? 0,
          tier: membership?.tier ?? "Sin membresia",
          currentStamps: stamps?.current_stamps ?? 0,
          requiredStamps: stamps?.required_stamps ?? 10,
          availableCampaigns: (data.campaigns ?? []).map((c: any) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            description: c.description ?? "",
            discountPercent: c.discount_percent,
            rewardPoints: c.reward_points ?? 0
          })),
          availableRewards: (data.rewards ?? []).map((r: any) => ({
            id: r.id,
            name: r.name,
            type: r.type,
            description: r.description ?? "",
            pointsRequired: r.points_required,
            creditAmountCents: r.credit_amount_cents
          })),
          availableMissions: (data.missions ?? []).map((m: any) => ({
            id: m.id,
            name: m.name,
            category: m.category,
            description: m.description ?? "",
            goal: m.goal ?? 1,
            progress: (data.progress ?? []).find((p: any) => p.mission_id === m.id)?.progress ?? 0,
            rewardPoints: m.reward_points ?? 0
          })),
          history: (data.activity ?? []).map((ev: any) => [
            "Reciente",
            ev.metadata?.label ?? ev.event_type,
            formatEventValue(ev.points_delta ?? 0, ev.credit_delta_cents ?? 0)
          ])
        };
      }
    } catch {
      // Fallback if not authenticated or offline
    }
  }

  const identity = usesDjango ? await backendRequest<{customer_id:string}>("/customer-identity/","POST",{}).catch(() => null) : null;

  const { data: business, error: businessError } = await db
    .from("businesses")
    .select("id, vip_purchase_threshold, at_risk_days, inactive_days")
    .eq("slug", "cafe-central")
    .maybeSingle();

  if (usesDjango && businessError) throw new Error("No pudimos cargar el comercio.");
  if (businessError || !business) return fallback;

  const { data: customer, error: customerError } = await db
    .from("customer_profiles")
    .select("id")
    .eq(identity ? "id" : "email", identity?.customer_id ?? "juan@loyloop.app")
    .maybeSingle();

  if (usesDjango && customerError) throw new Error("No pudimos cargar tu perfil.");
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

  const { data: behaviorEvents } = await db
    .from("loyalty_events")
    .select("event_type, created_at")
    .eq("business_id", business.id)
    .eq("customer_id", customer.id)
    .in("event_type", ["purchase", "stamp", "minipay_payment"])
    .order("created_at", { ascending: false });

  const purchaseCount = behaviorEvents?.length ?? 0;
  const lastVisitAt = behaviorEvents?.[0]?.created_at ?? null;
  const customerSegment = deriveCustomerSegment({
    purchaseCount,
    lastVisitAt,
    vipPurchaseThreshold: business.vip_purchase_threshold ?? 30,
    atRiskDays: business.at_risk_days ?? 90,
    inactiveDays: business.inactive_days ?? 180
  });
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
  if (usesDjango && campaignsError) throw new Error("No pudimos cargar las ofertas.");
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

  if (usesDjango && missionsError) throw new Error("No pudimos cargar las ofertas.");
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
    .select("id, name, type, description, points_required, credit_amount_cents, audience_segment")
    .eq("business_id", business.id)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (usesDjango && rewardsError) throw new Error("No pudimos cargar las ofertas.");
  const availableRewards = rewardsError
    ? fallback.availableRewards
    : (rewards ?? [])
        .filter((reward: any) => (reward.audience_segment ?? "active") === customerSegment)
        .map((reward: any) => ({
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

export type ExploreBusiness = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  address: string;
  city?: string;
  logoUrl?: string;
  isAvailable: boolean;
  isMember: boolean;
  points: number;
  tier: string;
  benefit?: string;
  distance?: string;
};

export type ExploreCatalogResult = {
  items: ExploreBusiness[];
  categories: string[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export async function getExploreCatalog(params?: {
  search?: string;
  category?: string;
  tab?: "all" | "memberships";
  page?: number;
  pageSize?: number;
}): Promise<ExploreCatalogResult> {
  const search = params?.search?.trim() ?? "";
  const category = params?.category?.trim() ?? "";
  const tab = params?.tab ?? "all";
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 10;

  if (usesDjango) {
    try {
      const queryParts: string[] = [];
      if (search) queryParts.push(`search=${encodeURIComponent(search)}`);
      if (category && category !== "Todos") queryParts.push(`category=${encodeURIComponent(category)}`);
      if (tab === "memberships") queryParts.push("membership=member");
      queryParts.push(`page=${page}`);
      queryParts.push(`page_size=${pageSize}`);
      const qs = queryParts.length ? `?${queryParts.join("&")}` : "";

      const data = await backendRequest<any>(`/discovery/${qs}`);
      const catalog = data.catalog ?? [];
      const rewards = data.rewards ?? [];
      const campaigns = data.campaigns ?? [];

      const items: ExploreBusiness[] = catalog.map((b: any) => {
        const reward = rewards.find((r: any) => r.business_id === b.id);
        const campaign = campaigns.find((c: any) => c.business_id === b.id);
        const benefit = campaign?.name || reward?.name || (b.is_member ? `${b.points_balance} pts acumulados` : "Únete al comercio");

        return {
          id: b.id,
          slug: b.slug,
          name: b.name,
          category: b.category,
          description: b.description || "",
          address: b.address || "",
          city: b.city || "",
          logoUrl: b.logo_url,
          isAvailable: b.is_available ?? true,
          isMember: Boolean(b.is_member),
          points: b.points_balance ?? 0,
          tier: b.tier || "Miembro",
          benefit,
          distance: "Cerca de ti"
        };
      });

      const categories = ["Todos", ...Array.from(new Set(catalog.map((c: any) => c.category).filter(Boolean))) as string[]];

      return {
        items,
        categories,
        pagination: data.pagination ?? {
          page,
          pageSize,
          total: items.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        }
      };
    } catch {
      // return fallback
    }
  }

  return {
    items: [
      {
        id: "demo-cafe",
        slug: "cafe-central",
        name: "Cafe Central",
        category: "Cafeteria",
        description: "Café de especialidad, postres y recompensas para clientes frecuentes.",
        address: "Cra. 7 #45-12, Bogotá",
        isAvailable: true,
        isMember: true,
        points: 120,
        tier: "Frecuente",
        benefit: "$5.000 credito",
        distance: "350 m"
      }
    ],
    categories: ["Todos", "Cafeteria"],
    pagination: {
      page: 1,
      pageSize,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    }
  };
}
