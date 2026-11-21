"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Coffee,
  Gift,
  Lock,
  Percent,
  QrCode,
  RefreshCw,
  Sparkles,
  Stamp,
  Store,
  TicketPercent,
  Wallet,
} from "lucide-react";
import { CustomerBottomNav } from "@/components/customer-bottom-nav";
import { ClaimQr } from "@/components/claim-qr";
import type { CustomerBenefitItem, CustomerBenefitsResult } from "@/lib/data/customer";

function getBenefitIcon(type: string, kind: string) {
  if (kind === "promotion") return Percent;
  if (type === "discount") return Percent;
  if (type === "credit") return Wallet;
  if (type === "points") return Sparkles;
  return Gift;
}

export default function RecompensasClientePage() {
  const [tab, setTab] = useState<"Todos" | "Recompensas" | "Promociones" | "Misiones">("Todos");
  const [data, setData] = useState<CustomerBenefitsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBenefits = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backend/discovery/", {
        headers: { "Cache-Control": "no-store" },
      });
      if (!res.ok) {
        throw new Error("No pudimos conectar con el servidor.");
      }
      const discovery = await res.json();
      const rewards = discovery.rewards || [];
      const campaigns = discovery.campaigns || [];
      const isV1 = typeof window !== "undefined" && window.location.search.includes("phase=v1");
      const missions = isV1 ? discovery.missions || [] : [];
      const memberships = discovery.memberships || [];

      const totalPoints = memberships.reduce((acc: number, m: any) => acc + (m.points_balance || 0), 0);

      const items: CustomerBenefitItem[] = [];

      // Recompensas
      for (const r of rewards) {
        items.push({
          id: r.id,
          kind: "reward",
          title: r.name,
          description: r.description || "Recompensa por tu fidelidad",
          businessId: r.business_id,
          businessName: r.business_name || "Comercio",
          businessSlug: r.business_slug || "cafe-central",
          condition: r.condition || (r.points_required ? `Requiere ${r.points_required} pts acumulados (no se descuentan)` : "Para miembros"),
          remainingQuota: r.remaining_quota,
          eligible: Boolean(r.eligible),
          actionType: r.type === "discount" ? "discount_redeem" : "stamp_redeem",
          payload: { rewardId: r.id, name: r.name },
        });
      }

      // Promociones
      for (const c of campaigns) {
        items.push({
          id: c.id,
          kind: "promotion",
          title: c.name,
          description: c.description || "Promoción por tiempo limitado",
          businessId: c.business_id,
          businessName: c.business_name || "Comercio",
          businessSlug: c.business_slug || "cafe-central",
          condition: c.condition || `${c.discount_percent || 0}% de descuento`,
          startsAt: c.starts_at,
          endsAt: c.ends_at,
          remainingQuota: c.remaining_quota,
          eligible: Boolean(c.eligible),
          actionType: c.type === "points_boost" ? "points_boost" : "discount_redeem",
          payload: { campaignId: c.id, name: c.name },
        });
      }

      // Misiones (solo si isV1)
      if (isV1) {
        for (const m of missions) {
          items.push({
            id: m.id,
            kind: "mission",
            title: m.name,
            description: m.description || "",
            businessId: m.business_id,
            businessName: m.business_name || "Comercio",
            businessSlug: m.business_slug || "cafe-central",
            condition: m.condition || `Meta: ${m.goal}`,
            startsAt: m.starts_at,
            endsAt: m.ends_at,
            eligible: Boolean(m.eligible),
            actionType: "stamp_add",
            payload: { missionId: m.id },
          });
        }
      }

      const availableTabs: Array<"Todos" | "Recompensas" | "Promociones" | "Misiones"> = isV1
        ? ["Todos", "Recompensas", "Promociones", "Misiones"]
        : ["Todos", "Recompensas", "Promociones"];

      setData({
        items,
        availableTabs,
        stats: {
          totalPoints,
          totalStamps: 6,
          availableCount: items.filter((i) => i.eligible).length,
        },
      });
    } catch (err: any) {
      setError(err?.message || "Error al cargar los beneficios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBenefits();
  }, []);

  const filteredItems = (data?.items || []).filter((item) => {
    if (tab === "Todos") return true;
    if (tab === "Recompensas") return item.kind === "reward";
    if (tab === "Promociones") return item.kind === "promotion";
    if (tab === "Misiones") return item.kind === "mission";
    return true;
  });

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 shadow-soft">
        <header className="bg-white px-5 pb-4 pt-8 border-b border-line">
          <h1 className="text-2xl font-black">Beneficios</h1>
          <p className="mt-1 text-sm text-muted">Todo lo que tienes para ganar y disfrutar</p>

          {/* Selector de Filtros / Tabs */}
          <div className="mt-4 flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Filtro de beneficios">
            {(data?.availableTabs || ["Todos", "Recompensas", "Promociones"]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                  tab === t ? "bg-white text-slate-900 shadow-sm" : "text-muted hover:text-slate-900"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </header>

        <section className="flex flex-1 flex-col gap-4 p-4 pb-24" aria-live="polite">
          {/* Tarjetas de Resumen / Estadísticas */}
          {data && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                  <Stamp className="h-4 w-4 text-amber-600" />
                  Sellos activos
                </span>
                <p className="mt-2 text-2xl font-black text-amber-950">{data.stats.totalStamps}</p>
                <p className="text-[11px] text-amber-700 mt-0.5">Independientes de puntos</p>
              </div>

              <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 shadow-sm">
                <span className="flex items-center gap-1.5 text-xs font-bold text-brand-800">
                  <Sparkles className="h-4 w-4 text-brand-600" />
                  Puntos de nivel
                </span>
                <p className="mt-2 text-2xl font-black text-brand-950">{data.stats.totalPoints}</p>
                <p className="text-[11px] text-brand-700 mt-0.5">Permanentes (no gastables)</p>
              </div>
            </div>
          )}

          {/* Estado de Carga */}
          {loading && (
            <div className="space-y-3 py-4" aria-label="Cargando beneficios">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-xl border border-line bg-white p-4">
                  <div className="flex gap-3">
                    <div className="h-11 w-11 rounded-lg bg-slate-200" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 w-3/4 rounded bg-slate-200" />
                      <div className="h-3 w-1/2 rounded bg-slate-200" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Estado de Error */}
          {!loading && error && (
            <div className="my-6 rounded-xl border border-red-200 bg-red-50 p-5 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
              <p className="mt-2 text-sm font-bold text-red-900">Error al cargar beneficios</p>
              <p className="mt-1 text-xs text-red-700">{error}</p>
              <button
                onClick={() => loadBenefits()}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar
              </button>
            </div>
          )}

          {/* Estado Vacío */}
          {!loading && !error && filteredItems.length === 0 && (
            <div className="my-8 rounded-xl border border-line bg-white p-6 text-center">
              <Gift className="mx-auto h-10 w-10 text-muted opacity-60" />
              <h3 className="mt-3 text-sm font-black text-slate-900">
                {tab === "Recompensas"
                  ? "No hay recompensas disponibles"
                  : tab === "Promociones"
                  ? "No hay promociones activas por ahora"
                  : tab === "Misiones"
                  ? "No hay misiones disponibles"
                  : "Aún no tienes beneficios disponibles"}
              </h3>
              <p className="mt-1 text-xs text-muted">
                {tab === "Recompensas"
                  ? "Visita tus comercios favoritos para avanzar de nivel y desbloquear recompensas."
                  : tab === "Promociones"
                  ? "Pronto tus comercios publicarán promociones por tiempo limitado."
                  : "Explora nuevos comercios para unirte a sus programas de fidelización."}
              </p>
              <Link
                href="/c/comercios"
                className="mt-4 inline-block rounded-lg bg-brand-500 px-4 py-2 text-xs font-bold text-white hover:bg-brand-600"
              >
                Explorar comercios
              </Link>
            </div>
          )}

          {/* Lista de Tarjetas de Beneficios */}
          {!loading && !error && filteredItems.length > 0 && (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const IconComponent = getBenefitIcon("", item.kind);
                const isPromo = item.kind === "promotion";
                const isReward = item.kind === "reward";

                return (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className="rounded-xl border border-line bg-white p-4 shadow-sm transition-all hover:border-brand-200"
                  >
                    <div className="flex gap-3">
                      <span
                        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${
                          isPromo
                            ? "bg-purple-50 text-purple-700"
                            : isReward
                            ? "bg-amber-50 text-amber-700"
                            : "bg-brand-50 text-brand-600"
                        }`}
                      >
                        <IconComponent className="h-6 w-6" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                              {isPromo ? "Promoción" : isReward ? "Recompensa" : "Misión"} ·{" "}
                              <Link
                                href={`/c/${item.businessSlug}`}
                                className="text-slate-900 hover:underline"
                              >
                                {item.businessName}
                              </Link>
                            </span>
                            <h3 className="font-black text-sm text-slate-900 mt-0.5 truncate">
                              {item.title}
                            </h3>
                          </div>

                          {item.eligible ? (
                            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              Elegible
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Bloqueado
                            </span>
                          )}
                        </div>

                        {item.description && (
                          <p className="mt-1 text-xs text-slate-600 line-clamp-1">{item.description}</p>
                        )}

                        <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                          <span className="font-semibold text-brand-600 truncate max-w-[200px]">
                            {item.condition}
                          </span>

                          {item.endsAt && (
                            <span className="flex items-center gap-1 text-[11px] text-muted shrink-0">
                              <Calendar className="h-3 w-3" />
                              Hasta {new Date(item.endsAt).toLocaleDateString("es-CO")}
                            </span>
                          )}
                        </div>

                        {/* Flujo de canje QR / Código Manual LL-23 */}
                        {item.eligible ? (
                          <div className="mt-3 pt-2">
                            <ClaimQr
                              action={item.actionType}
                              businessName={item.businessName}
                              label={item.title}
                              description={`Presenta este código en ${item.businessName} para recibir tu beneficio.`}
                              payload={{ ...item.payload, businessSlug: item.businessSlug }}
                            >
                              <span className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-600 cursor-pointer">
                                <QrCode className="h-3.5 w-3.5" />
                                Presentar QR para canjear
                              </span>
                            </ClaimQr>
                          </div>
                        ) : (
                          <div className="mt-3 pt-1">
                            <button
                              disabled
                              className="w-full rounded-lg bg-slate-100 py-2 text-xs font-semibold text-slate-400 cursor-not-allowed"
                            >
                              No cumples las condiciones aún
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <CustomerBottomNav active="Recompensas" />
      </div>
    </main>
  );
}
