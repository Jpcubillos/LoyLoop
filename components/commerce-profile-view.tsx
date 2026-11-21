"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  Coffee,
  Gift,
  History,
  MapPin,
  Percent,
  QrCode,
  Share2,
  Sparkles,
  Star,
  Store,
  UserPlus,
  AlertCircle,
  Scissors,
  Waves,
} from "lucide-react";
import { CustomerBottomNav } from "@/components/customer-bottom-nav";
import { ClaimQr } from "@/components/claim-qr";
import { StampCard } from "@/components/stamp-card";
import { joinBusinessAction } from "@/lib/actions/app-users";
import type { CommerceProfile } from "@/lib/data/customer";

function getCategoryIcon(category: string) {
  const cat = (category || "").toLowerCase();
  if (cat.includes("caf")) return Coffee;
  if (cat.includes("barber") || cat.includes("pelu")) return Scissors;
  if (cat.includes("lavad") || cat.includes("auto")) return Waves;
  return Store;
}

export function CommerceProfileView({
  initialProfile,
}: {
  initialProfile: CommerceProfile;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<CommerceProfile>(initialProfile);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const business = profile.business;
  const isMember = business.isMember;
  const IconComponent = getCategoryIcon(business.category);

  const handleJoin = async () => {
    setIsJoining(true);
    setJoinError(null);
    try {
      await joinBusinessAction(business.id);
      setProfile((prev) => ({
        ...prev,
        business: {
          ...prev.business,
          isMember: true,
          points: 0,
          tier: "Miembro",
        },
        membership: {
          id: "mem-created",
          points: 0,
          tier: "Miembro",
          joinedAt: new Date().toISOString(),
        },
      }));
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setJoinError(err?.message || "No pudimos completar tu inscripción al comercio.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({
        title: business.name,
        text: `Descubre ${business.name} en LoyLoop:`,
        url: window.location.href,
      }).catch(() => {});
    }
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 shadow-soft">
        {/* Cabecera del Comercio */}
        <header className="bg-brand-500 px-5 pb-6 pt-8 text-white">
          <div className="mb-4 flex items-center justify-between">
            <Link
              href="/c/comercios"
              className="grid h-9 w-9 place-items-center rounded-lg bg-white/12 text-white hover:bg-white/20 transition-all"
              aria-label="Volver al catálogo de comercios"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <button
              onClick={handleShare}
              className="grid h-9 w-9 place-items-center rounded-lg bg-white/12 text-white hover:bg-white/20 transition-all"
              aria-label="Compartir comercio"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/14 ring-2 ring-white/30 text-white shadow-sm">
              <IconComponent className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-black">{business.name}</h1>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
                  {isMember ? "Miembro" : "Disponible"}
                </span>
              </div>
              <p className="text-xs text-blue-100">{business.category}</p>
              {business.address && (
                <p className="mt-1 flex items-center gap-1 text-xs text-blue-100 truncate">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {business.address}
                </p>
              )}
            </div>
          </div>
        </header>

        {/* Contenido Principal */}
        <section className="flex flex-1 flex-col gap-4 p-4 pb-24">
          {/* CASO: NO MIEMBRO -> Propuesta, Sedes y CTA de Unión */}
          {!isMember && (
            <div className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Gift className="h-6 w-6" />
                </span>
                <div className="flex-1">
                  <h2 className="text-base font-black text-slate-900">Únete a {business.name}</h2>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    {business.description ||
                      "Acumula puntos locales permanentes por cada compra, avanza de nivel y recibe recompensas exclusivas sin perder tus puntos."}
                  </p>
                </div>
              </div>

              {/* Sedes disponibles */}
              {business.sedes.length > 0 && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-brand-500" />
                    Sedes disponibles:
                  </p>
                  <div className="mt-1.5 space-y-1">
                    {business.sedes.map((sede) => (
                      <p key={sede.id} className="text-xs text-slate-600">
                        • {sede.name} — {sede.address}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Botón CTA de Unión */}
              <button
                onClick={handleJoin}
                disabled={isJoining}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-brand-600 disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                {isJoining ? "Inscribiéndote…" : `Unirme al club de ${business.name}`}
              </button>

              {joinError && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{joinError}</span>
                </div>
              )}
            </div>
          )}

          {/* CASO: MIEMBRO -> Progreso de Nivel, Sellos y QR de Cliente */}
          {isMember && (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800">
                <Check className="h-4 w-4 text-emerald-600" />
                <span>Miembro activo de {business.name}</span>
              </div>

              {/* Tarjeta de Progreso de Nivel (Puntos acumulados permanentes) */}
              <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-muted">Nivel del comercio</p>
                    <p className="mt-0.5 text-2xl font-black text-slate-900">{profile.membership?.tier || business.tier}</p>
                    <p className="text-xs font-semibold text-brand-600 mt-1">
                      {business.points} puntos acumulados
                    </p>
                  </div>
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                    <Sparkles className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-3 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600 border border-slate-100">
                  💡 <strong>Puntos permanentes:</strong> Tus puntos nunca caducan ni se descuentan al canjear recompensas.
                </div>
              </div>

              {/* Tarjeta de Sellos Independientes (si el comercio tiene sellos) */}
              {profile.stamps && (
                <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
                  <StampCard
                    currentStamps={profile.stamps.currentStamps}
                    requiredStamps={profile.stamps.requiredStamps}
                    message={profile.stamps.condition}
                  />
                </div>
              )}

              {/* Botón para Presentar QR de Cliente en el Comercio */}
              <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Validar en caja</h3>
                    <p className="text-xs text-muted">Presenta tu QR o código manual al comercio</p>
                  </div>
                  <ClaimQr
                    action="stamp_add"
                    businessName={business.name}
                    label="Validar visita en caja"
                    description={`Presenta este código al comercio para validar tu visita.`}
                    payload={{ action: "identify", businessSlug: business.slug }}
                  >
                    <span className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-brand-600 cursor-pointer">
                      <QrCode className="h-4 w-4" />
                      Mostrar QR
                    </span>
                  </ClaimQr>
                </div>
              </div>
            </>
          )}

          {/* Catálogo de Recompensas */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900">
              {isMember ? "Recompensas disponibles" : "Recompensas que podrás obtener"}
            </h3>

            {profile.rewards.length === 0 ? (
              <div className="rounded-xl border border-line bg-white p-5 text-center text-xs text-muted">
                No hay recompensas registradas en este comercio por ahora.
              </div>
            ) : (
              <div className="space-y-2">
                {profile.rewards.map((reward) => (
                  <div
                    key={reward.id}
                    className="rounded-xl border border-line bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-sm text-slate-900">{reward.name}</p>
                        <p className="text-xs text-muted mt-0.5">{reward.description}</p>
                        <p className="text-xs font-semibold text-brand-600 mt-2">
                          {reward.condition}
                        </p>
                      </div>
                      {isMember && reward.eligible ? (
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                          Elegible
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                          {isMember ? "Bloqueado" : "Únete para canjear"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Promociones Activas */}
          {profile.campaigns.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-black text-slate-900">Promociones activas</h3>
              <div className="space-y-2">
                {profile.campaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="rounded-xl border border-line bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-sm text-slate-900">{camp.name}</p>
                        <p className="text-xs text-muted mt-0.5">{camp.description}</p>
                        <p className="text-xs font-semibold text-emerald-700 mt-1.5">
                          {camp.condition}
                        </p>
                      </div>
                      {camp.remainingQuota !== null && camp.remainingQuota !== undefined && (
                        <span className="shrink-0 text-xs text-muted">
                          Cupo: {camp.remainingQuota}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Misiones (solo si están habilitadas en V1) */}
          {profile.missions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-black text-slate-900">Misiones del club</h3>
              <div className="space-y-2">
                {profile.missions.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-line bg-white p-4 shadow-sm"
                  >
                    <p className="font-bold text-sm text-slate-900">{m.name}</p>
                    <p className="text-xs text-muted mt-0.5">{m.description}</p>
                    <p className="text-xs font-semibold text-indigo-600 mt-1">
                      {m.condition}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historial Reciente (solo miembros) */}
          {isMember && profile.history.length > 0 && (
            <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <History className="h-4 w-4 text-muted" />
                <h3 className="text-sm font-black text-slate-900">Actividad reciente</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {profile.history.map(([when, label, delta], idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{label}</p>
                      <p className="text-[10px] text-muted">{when}</p>
                    </div>
                    <span className="font-bold text-slate-900">{delta}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <CustomerBottomNav active="Comercios" />
      </div>
    </main>
  );
}
