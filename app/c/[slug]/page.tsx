import { notFound } from "next/navigation";
import { getCommerceProfile } from "@/lib/data/customer";
import { CommerceProfileView } from "@/components/commerce-profile-view";

export default async function CommerceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ phase?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  if (!slug || !/^[a-zA-Z0-9_-]+$/.test(slug)) {
    notFound();
  }

  const profile = await getCommerceProfile(slug, query?.phase);

  return <CommerceProfileView initialProfile={profile} />;
}
