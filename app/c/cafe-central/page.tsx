import {
  Check,
  ChevronRight,
  Coffee,
  Gift,
  History,
  MapPin,
  Percent,
  Repeat,
  Share2,
  Smartphone,
  Sparkles,
  Star,
  TicketPercent,
  UserPlus,
  Wallet
} from "lucide-react";
import { CustomerBottomNav } from "@/components/customer-bottom-nav";
import { StampCard } from "@/components/stamp-card";
import { getCafeCentralCustomerState } from "@/lib/data/customer";
import { ClaimQr } from "@/components/claim-qr";

const history = [
  ["Hoy", "Te uniste al club", "+20 pts"],
  ["Hoy", "Credito de bienvenida", "$5.000"],
  ["Ayer", "Compra registrada", "+15 pts"]
];

const missionIcons = {
  frequency: Repeat,
  referral: UserPlus,
  offpeak: Coffee,
  minipay: Smartphone,
  review: Star
};

const rewardIcons = {
  discount: Percent,
  points: Star,
  credit: Wallet,
  product: Gift
};

function formatCurrency(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString("es-CO")}`;
}

export default async function CafeCentralPage({
  searchParams
}: {
  searchParams?: Promise<{ stamp?: string }>;
}) {
  const customerState = await getCafeCentralCustomerState();
  const params = await searchParams;
  const stampMessage = params?.stamp === "max"
    ? "Ya llegaste al maximo de sellos. Redime tu recompensa para empezar una nueva tarjeta."
    : undefined;

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 shadow-soft">
        <header className="bg-brand-500 px-5 pb-6 pt-8 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/14 ring-2 ring-white/30">
                <Coffee className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-black">Cafe Central</h1>
                <p className="text-sm text-blue-100">Cafeteria</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-blue-100">
                  <MapPin className="h-3 w-3" />
                  Cra. 7 #45-12, Bogota
                </p>
              </div>
            </div>
            <button className="grid h-10 w-10 place-items-center rounded-lg bg-white/12">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </header>

        <section className="flex flex-1 flex-col gap-4 p-4 pb-24">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            <Check className="h-4 w-4" />
            Te uniste a Cafe Central
          </div>

          <div className="rounded-lg border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-muted">Nivel actual</p>
                <p className="mt-1 text-2xl font-black">{customerState.tier}</p>
              </div>
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-amber-50 text-amber-700">
                <Sparkles className="h-6 w-6" />
              </span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-slate-100">
              <div className="h-full w-[68%] rounded-full bg-brand-500" />
            </div>
            <p className="mt-2 text-xs text-muted">Te faltan 80 puntos para llegar a VIP.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <Star className="h-5 w-5 text-amber-800" />
              <p className="mt-4 text-3xl font-black text-amber-950">{customerState.points}</p>
              <p className="text-xs text-amber-800">puntos</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <Wallet className="h-5 w-5 text-emerald-700" />
              <p className="mt-4 text-3xl font-black text-emerald-700">{formatCurrency(customerState.creditCents)}</p>
              <p className="text-xs text-emerald-700">credito para tu compra</p>
            </div>
          </div>

          <section>
            <h2 className="mb-3 text-sm font-black">Recompensas activas</h2>
            <div className="space-y-3">
              <StampCard
                currentStamps={customerState.currentStamps}
                requiredStamps={customerState.requiredStamps}
                message={stampMessage}
              />
              {customerState.availableRewards.map((reward) => {
                const Icon = rewardIcons[reward.type] ?? Gift;
                const requirement = reward.pointsRequired
                  ? `${reward.pointsRequired} puntos`
                  : reward.creditAmountCents
                    ? formatCurrency(reward.creditAmountCents)
                    : "Disponible en caja";

                return (
                  <div key={reward.id} className="rounded-lg border border-line bg-white p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">{reward.name}</p>
                        <p className="text-xs text-muted">{reward.description}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-muted">
                        {requirement}
                      </span>
                    </div>
                  </div>
                );
              })}
              {customerState.availableCampaigns.map((campaign) => {
                const Icon = campaign.type === "points_boost" ? TicketPercent : Percent;

                return (
                  <ClaimQr
                    key={campaign.id}
                    action={campaign.type}
                    label={campaign.name}
                    description={`Genera este QR para que el comercio valide: ${campaign.description}.`}
                    payload={{
                      campaignId: campaign.id,
                      campaignName: campaign.name,
                      discountPercent: campaign.discountPercent,
                      rewardPoints: campaign.rewardPoints
                    }}
                    className="block w-full rounded-lg border border-line bg-white p-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-lg bg-brand-50 text-brand-600">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">{campaign.name}</p>
                        <p className="text-xs text-muted">{campaign.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted" />
                    </div>
                  </ClaimQr>
                );
              })}
              {!customerState.availableCampaigns.length && (
                <div className="rounded-lg border border-dashed border-line bg-white p-4 text-sm font-bold text-muted">
                  No tienes campanas disponibles por ahora.
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-black">Misiones activas</h2>
            <div className="space-y-3">
              {customerState.availableMissions.map((mission) => {
                const Icon = missionIcons[mission.category] ?? Repeat;

                return (
                  <div key={mission.id} className="rounded-lg border border-line bg-white p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-lg bg-slate-100 text-ink">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">{mission.name}</p>
                        <p className="text-xs text-muted">{mission.description}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                        +{mission.rewardPoints} pts
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${mission.progress}%` }} />
                    </div>
                  </div>
                );
              })}
              {!customerState.availableMissions.length && (
                <div className="rounded-lg border border-dashed border-line bg-white p-4 text-sm font-bold text-muted">
                  No tienes misiones disponibles por ahora.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-brand-500" />
              <h2 className="text-sm font-black">Actividad reciente</h2>
            </div>
            <div className="space-y-3">
              {customerState.history.map(([date, action, value], index) => (
                <div key={`${date}-${action}-${value}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-bold">{action}</p>
                    <p className="text-xs text-muted">{date}</p>
                  </div>
                  <span className="font-black text-brand-700">{value}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-2">
            <button className="btn-primary h-12 justify-between">
              <span className="inline-flex items-center gap-2"><Gift className="h-4 w-4" /> Ver recompensas</span>
              <ChevronRight className="h-4 w-4" />
            </button>
            <button className="btn-secondary h-12">
              <Smartphone className="h-4 w-4" />
              Pagar con MiniPay
            </button>
          </div>
        </section>

        <CustomerBottomNav active="Inicio" />
      </div>
    </main>
  );
}
