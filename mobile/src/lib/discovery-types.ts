// DRF read-model contracts. Identity is selected by the server, never by these DTOs.
export type CatalogueRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  address: string | null;
  logo_url?: string;
  vip_purchase_threshold: number;
  at_risk_days: number;
  inactive_days: number;
};
export type MembershipRow = {
  business_id: string;
  points_balance: number;
  tier: string;
};
export type ActivityRow = {
  id?: string;
  business_id: string;
  event_type: string;
  created_at: string;
  points_delta?: number;
  credit_delta_cents?: number;
  metadata?: Record<string, unknown>;
};
export type PreviewRow = { business_id: string; name: string; created_at: string };
export type Dates = { starts_at?: string | null; ends_at?: string | null };
export type Audience = { audience_segment?: string | null };
export type Quota = {
  redemption_limit?: number | null;
  remaining_quota?: number | null;
  redemptions_count?: number;
};

export type DiscoveryData = {
  catalog: CatalogueRow[];
  memberships: MembershipRow[];
  activity: ActivityRow[];
  rewards: PreviewRow[];
  campaigns: (PreviewRow & Dates)[];
};

export type DiscoveryDetail = {
  stamps: {
    id?: string;
    current_stamps: number;
    required_stamps: number;
    reward_name: string;
    eligible?: boolean;
    condition?: string;
  } | null;
  membership?: {
    id: string;
    points_balance: number;
    credit_balance_cents?: number;
    tier: string;
    joined_at?: string | null;
  } | null;
  rewards: ({
    id: string;
    name: string;
    description?: string | null;
    points_required: number;
    type: "discount" | "points" | "credit" | "product";
    eligible?: boolean;
    condition?: string;
  } & Audience & Quota)[];
  campaigns: ({
    id: string;
    name: string;
    description?: string | null;
    status: string;
    type: "discount_redeem" | "points_boost";
    discount_percent: number | null;
    reward_points: number;
    eligible?: boolean;
    condition?: string;
    already_redeemed?: boolean;
  } & Dates & Audience & Quota)[];
  missions: ({
    id: string;
    name: string;
    description?: string | null;
    goal: number;
    reward_points: number;
    eligible?: boolean;
    condition?: string;
  } & Dates & Audience)[];
  progress: {
    mission_id: string;
    progress: number;
    completed_at: string | null;
  }[];
  activity?: ActivityRow[];
};
