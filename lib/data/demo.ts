import { supabase } from "@/lib/supabase/client";

export type CustomerBusiness = {
  name: string;
  category: string;
  points: number;
  credit: string;
  href: string;
};

function formatCredit(cents: number) {
  if (!cents) return "Sin credito";
  return `$${Math.round(cents / 100).toLocaleString("es-CO")}`;
}

export async function getCustomerBusinessesForDemo(): Promise<CustomerBusiness[]> {
  const { data: customer } = await supabase
    .from("customer_profiles")
    .select("id")
    .eq("email", "juan@loyloop.app")
    .maybeSingle<{ id: string }>();

  if (!customer) return [];

  const { data, error } = await supabase
    .from("business_memberships")
    .select("points_balance, credit_balance_cents, businesses(slug, name, category)")
    .eq("customer_id", customer.id);

  if (error || !data) return [];

  return (data as unknown as Array<{
    points_balance: number;
    credit_balance_cents: number;
    businesses: { slug: string; name: string; category: string } | { slug: string; name: string; category: string }[] | null;
  }>)
    .map((membership) => {
      const business = Array.isArray(membership.businesses)
        ? membership.businesses[0]
        : membership.businesses;

      if (!business) return null;

      return {
        name: business.name,
        category: business.category,
        points: membership.points_balance,
        credit: formatCredit(membership.credit_balance_cents),
        href: business.slug === "cafe-central" ? "/c/cafe-central" : "/c/comercios"
      };
    })
    .filter(Boolean) as CustomerBusiness[];
}
