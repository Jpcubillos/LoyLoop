import Link from "next/link";
import { Coffee, Gift, Percent, Sparkles, Stamp, TicketPercent, Wallet } from "lucide-react";
import { CustomerBottomNav } from "@/components/customer-bottom-nav";
import { getCafeCentralCustomerState } from "@/lib/data/customer";

function formatCurrency(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString("es-CO")}`;
}

export default async function RecompensasClientePage() {
  const customerState = await getCafeCentralCustomerState();
  const rewards = [
    {
      business: "Cafe Central",
      title: "Cafe gratis",
      detail: `${customerState.currentStamps}/${customerState.requiredStamps} sellos`,
      icon: Coffee,
      tone: "amber",
      href: "/c/cafe-central"
    },
    ...customerState.availableRewards.map((reward) => ({
      business: "Cafe Central",
      title: reward.name,
      detail: reward.pointsRequired
        ? `${reward.pointsRequired} puntos`
        : reward.creditAmountCents
          ? formatCurrency(reward.creditAmountCents)
          : reward.description,
      icon: reward.type === "discount" ? Percent : reward.type === "credit" ? Wallet : reward.type === "points" ? Sparkles : Gift,
      tone: reward.type === "credit" ? "green" : reward.type === "product" ? "amber" : "blue",
      href: "/c/cafe-central"
    })),
    ...customerState.availableCampaigns.map((campaign) => ({
      business: "Cafe Central",
      title: campaign.name,
      detail: campaign.type === "points_boost" ? `+${campaign.rewardPoints} puntos` : `${campaign.discountPercent ?? 0}% descuento`,
      icon: campaign.type === "points_boost" ? TicketPercent : Percent,
      tone: "blue",
      href: "/c/cafe-central"
    }))
  ];

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 shadow-soft">
        <header className="bg-white px-5 pb-5 pt-8">
          <h1 className="text-2xl font-black">Recompensas</h1>
          <p className="mt-1 text-sm text-muted">Beneficios disponibles en tus comercios</p>
        </header>
        <section className="flex flex-1 flex-col gap-4 p-4 pb-24">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <Stamp className="h-5 w-5 text-amber-700" />
              <p className="mt-3 text-2xl font-black">6</p>
              <p className="text-xs text-amber-800">sellos activos</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <Wallet className="h-5 w-5 text-emerald-700" />
              <p className="mt-3 text-2xl font-black">$5.000</p>
              <p className="text-xs text-emerald-800">credito total</p>
            </div>
          </div>
          <div className="space-y-3">
            {rewards.map((reward) => (
              <Link key={`${reward.business}-${reward.title}-${reward.detail}`} href={reward.href} className="block rounded-lg border border-line bg-white p-4">
                <div className="flex items-center gap-3">
                  <span className={`grid h-11 w-11 place-items-center rounded-lg ${
                    reward.tone === "green" ? "bg-emerald-50 text-emerald-700" : reward.tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-brand-50 text-brand-600"
                  }`}>
                    <reward.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{reward.title}</p>
                    <p className="text-xs text-muted">{reward.business} · {reward.detail}</p>
                  </div>
                  <Gift className="h-4 w-4 text-muted" />
                </div>
              </Link>
            ))}
          </div>
        </section>
        <CustomerBottomNav active="Recompensas" />
      </div>
    </main>
  );
}
