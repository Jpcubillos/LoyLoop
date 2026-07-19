import { supabase } from "@/lib/supabase/client";

const db = supabase as any;

export type AppUser = {
  id: string;
  email: string;
  fullName: string;
  accountType: "business" | "customer";
  businessRole: "owner" | "manager" | "cashier" | null;
  customerSegment: "inactive" | "at_risk" | "active" | "vip" | null;
  active: boolean;
};

const fallbackUsers: AppUser[] = [
  {
    id: "owner-demo",
    email: "owner@loyloop.app",
    fullName: "Dueños Cafe Central",
    accountType: "business",
    businessRole: "owner",
    customerSegment: null,
    active: true
  },
  {
    id: "cashier-demo",
    email: "cajero@loyloop.app",
    fullName: "Cajero Cafe Central",
    accountType: "business",
    businessRole: "cashier",
    customerSegment: null,
    active: true
  },
  {
    id: "vip-demo",
    email: "cliente.vip@loyloop.app",
    fullName: "Cliente VIP",
    accountType: "customer",
    businessRole: null,
    customerSegment: "vip",
    active: true
  }
];

export async function getAppUsers(): Promise<AppUser[]> {
  const { data, error } = await db
    .from("app_users")
    .select("id, email, full_name, account_type, business_role, customer_segment, active")
    .order("created_at", { ascending: true });

  if (error || !data?.length) return fallbackUsers;

  return data.map((user: any) => ({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    accountType: user.account_type,
    businessRole: user.business_role,
    customerSegment: user.customer_segment,
    active: user.active
  }));
}
