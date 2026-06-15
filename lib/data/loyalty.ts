import { supabase } from "@/lib/supabase/client";

export async function getBusinessBySlug(slug: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) throw error;
  return data;
}

export async function getBusinessRewards(businessId: string) {
  const { data, error } = await supabase
    .from("rewards")
    .select("*")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getBusinessMissions(businessId: string) {
  const { data, error } = await supabase
    .from("missions")
    .select("*")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getCustomerMemberships(customerId: string) {
  const { data, error } = await supabase
    .from("business_memberships")
    .select("*, businesses(*)")
    .eq("customer_id", customerId)
    .order("joined_at", { ascending: false });

  if (error) throw error;
  return data;
}
