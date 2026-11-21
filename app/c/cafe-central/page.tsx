import { getCommerceProfile } from "@/lib/data/customer";
import { CommerceProfileView } from "@/components/commerce-profile-view";

export default async function CafeCentralPage({
  searchParams,
}: {
  searchParams?: Promise<{ phase?: string }>;
}) {
  const params = await searchParams;
  const profile = await getCommerceProfile("cafe-central", params?.phase);

  return <CommerceProfileView initialProfile={profile} />;
}
