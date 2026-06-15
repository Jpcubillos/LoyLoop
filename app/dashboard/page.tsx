import Link from "next/link";
import { Activity, ArrowUpRight, Download, Gift, QrCode, TrendingUp, Users, Wallet } from "lucide-react";
import { campaigns, chart, dashboardStats, recentActivity } from "@/lib/dashboard-data";

const statIcons = [Users, Activity, Gift, Wallet];

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  const classes = {
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-brand-50 text-brand-700",
    slate: "bg-slate-100 text-slate-600"
  }[tone] ?? "bg-slate-100 text-slate-600";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}>{label}</span>;
}

export default function DashboardPage() {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Inicio</h1>
          <p className="mt-1 text-muted">Resumen de la actividad de tu comercio</p>
        </div>
        <Link href="/dashboard/recompensas" className="btn-primary">
          <Gift className="h-4 w-4" />
          Crear recompensa
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardStats.map((stat, index) => {
          const Icon = statIcons[index];
          return (
            <div key={stat.label} className="rounded-lg border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted">{stat.label}</p>
                  <p className="mt-1 text-2xl font-black">{stat.value}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                    <TrendingUp className="h-3 w-3" />
                    {stat.change}
                  </span>
                </div>
                <span className={`grid h-10 w-10 place-items-center rounded-lg ${
                  stat.tone === "green" ? "bg-emerald-50 text-emerald-600" : stat.tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-brand-50 text-brand-600"
                }`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_428px]">
        <div className="rounded-lg border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line p-4">
            <h2 className="font-black">Actividad reciente</h2>
            <Link href="/dashboard/clientes" className="btn-ghost">
              Ver todo <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[660px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Acción</th>
                  <th className="px-4 py-3 text-right">Puntos</th>
                  <th className="px-4 py-3 text-right">Cuándo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recentActivity.map(([name, initials, action, points, time]) => (
                  <tr key={name}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-bold">{initials}</span>
                        <span className="font-bold">{name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{action}</td>
                    <td className={`px-4 py-3 text-right font-black ${points.startsWith("+") ? "text-emerald-600" : "text-ink"}`}>{points}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted">{time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-4">
          <h2 className="font-black">Campañas activas</h2>
          <div className="mt-4 space-y-3">
            {campaigns.map((campaign) => (
              <div key={campaign.name} className="rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold">{campaign.name}</p>
                  <StatusBadge label={campaign.status} tone={campaign.tone} />
                </div>
                <div className="mt-2 flex gap-4 text-xs text-muted">
                  <span>{campaign.reach} alcance</span>
                  <span>{campaign.redemptions} redenciones</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_330px]">
        <div className="rounded-lg border border-line bg-white p-5">
          <h2 className="font-black">Rendimiento de recompensas</h2>
          <div className="mt-5 flex h-56 items-end gap-3">
            {chart.map((value, index) => (
              <div key={index} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t-lg bg-brand-500" style={{ height: `${value}%` }} />
                </div>
                <span className="text-xs text-muted">{["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][index]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-5">
          <h2 className="font-black">QR del comercio</h2>
          <div className="mt-5 grid aspect-square place-items-center rounded-lg border border-line bg-brand-50">
            <QrCode className="h-32 w-32 text-brand-700" />
          </div>
          <p className="mt-4 text-center text-sm font-bold">Café Central</p>
          <Link href="/c/cafe-central" className="btn-secondary mt-4 w-full">
            <Download className="h-4 w-4" />
            Ver demo cliente
          </Link>
        </div>
      </div>
    </>
  );
}
