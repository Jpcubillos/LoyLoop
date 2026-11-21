"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Coffee, MapPin, Search, Scissors, Star, Store, Waves, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { CustomerBottomNav } from "@/components/customer-bottom-nav";

type BusinessItem = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  address: string;
  city?: string;
  logoUrl?: string;
  isAvailable: boolean;
  isMember: boolean;
  points: number;
  tier: string;
  benefit?: string;
  distance?: string;
};

type CatalogResponse = {
  catalog?: Array<{
    id: string;
    slug: string;
    name: string;
    category: string;
    description?: string;
    address?: string;
    city?: string;
    logo_url?: string;
    is_available?: boolean;
    is_member?: boolean;
    points_balance?: number;
    tier?: string;
  }>;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  rewards?: Array<{ business_id: string; name: string }>;
  campaigns?: Array<{ business_id: string; name: string }>;
};

function getCategoryIcon(category: string) {
  const cat = (category || "").toLowerCase();
  if (cat.includes("caf")) return Coffee;
  if (cat.includes("barber") || cat.includes("pelu")) return Scissors;
  if (cat.includes("lavad") || cat.includes("auto")) return Waves;
  return Store;
}

export default function ComerciosPage() {
  const [tab, setTab] = useState<"all" | "member">("all");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [categories, setCategories] = useState<string[]>(["Todos"]);
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchBusinesses = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (selectedCategory && selectedCategory !== "Todos") params.set("category", selectedCategory);
      if (tab === "member") params.set("membership", "member");
      params.set("page", String(page));
      params.set("page_size", String(pageSize));

      const res = await fetch(`/api/backend/discovery/?${params.toString()}`, {
        headers: { "Cache-Control": "no-store" },
      });

      if (!res.ok) {
        throw new Error("No pudimos conectar con el servidor de comercios.");
      }

      const data: CatalogResponse = await res.json();
      const rawCatalog = data.catalog || [];
      const rewards = data.rewards || [];
      const campaigns = data.campaigns || [];

      const mapped: BusinessItem[] = rawCatalog.map((b) => {
        const reward = rewards.find((r) => r.business_id === b.id);
        const campaign = campaigns.find((c) => c.business_id === b.id);
        const benefit = campaign?.name || reward?.name || (b.is_member ? `${b.points_balance || 0} pts acumulados` : "Únete para recibir beneficios");

        return {
          id: b.id,
          slug: b.slug,
          name: b.name,
          category: b.category,
          description: b.description || "",
          address: b.address || "",
          city: b.city || "",
          logoUrl: b.logo_url,
          isAvailable: b.is_available ?? true,
          isMember: Boolean(b.is_member),
          points: b.points_balance || 0,
          tier: b.tier || "Miembro",
          benefit,
          distance: b.city ? `${b.city}` : "Cerca de ti",
        };
      });

      setBusinesses(mapped);

      // Collect available categories dynamically
      if (rawCatalog.length > 0) {
        const uniqueCats = Array.from(new Set(rawCatalog.map((b) => b.category).filter(Boolean)));
        setCategories(["Todos", ...uniqueCats]);
      }

      if (data.pagination) {
        setPagination(data.pagination);
      } else {
        setPagination({
          page,
          pageSize,
          total: mapped.length,
          totalPages: Math.max(1, Math.ceil(mapped.length / pageSize)),
          hasNext: false,
          hasPrev: page > 1,
        });
      }
    } catch (err: any) {
      setError(err?.message || "Error al cargar los comercios. Revisa tu conexión de red.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBusinesses();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selectedCategory, tab, page]);

  const handleTabChange = (newTab: "all" | "member") => {
    setTab(newTab);
    setPage(1);
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 shadow-soft">
        <header className="bg-white px-5 pb-4 pt-8 border-b border-line">
          <h1 className="text-2xl font-black">Comercios</h1>
          <p className="mt-1 text-sm text-muted">Explora tus clubes favoritos y beneficios cerca de ti</p>

          {/* Selector de pestañas */}
          <div className="mt-4 flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Filtro de membresía">
            <button
              role="tab"
              aria-selected={tab === "all"}
              onClick={() => handleTabChange("all")}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                tab === "all" ? "bg-white text-slate-900 shadow-sm" : "text-muted hover:text-slate-900"
              }`}
            >
              Explorar todos
            </button>
            <button
              role="tab"
              aria-selected={tab === "member"}
              onClick={() => handleTabChange("member")}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                tab === "member" ? "bg-white text-slate-900 shadow-sm" : "text-muted hover:text-slate-900"
              }`}
            >
              Mis comercios
            </button>
          </div>

          {/* Campo de búsqueda */}
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 py-2" role="search">
            <Search className="h-4 w-4 text-muted" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar por nombre o categoría…"
              aria-label="Buscar por nombre o categoría"
              className="w-full bg-transparent text-sm placeholder:text-muted focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                aria-label="Limpiar búsqueda"
                className="text-xs font-bold text-muted hover:text-slate-700"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtros de categoría */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Categorías">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  selectedCategory === cat
                    ? "bg-brand-500 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </header>

        {/* Contenido principal */}
        <section className="flex flex-1 flex-col gap-3 p-4 pb-24" aria-live="polite">
          {/* Estado de Carga */}
          {loading && (
            <div className="space-y-3 py-4" aria-label="Cargando comercios">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-xl border border-line bg-white p-4">
                  <div className="flex gap-3">
                    <div className="h-12 w-12 rounded-lg bg-slate-200" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 w-3/4 rounded bg-slate-200" />
                      <div className="h-3 w-1/2 rounded bg-slate-200" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Estado de Error de Red */}
          {!loading && error && (
            <div className="my-6 rounded-xl border border-red-200 bg-red-50 p-5 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
              <p className="mt-2 text-sm font-bold text-red-900">Error al cargar comercios</p>
              <p className="mt-1 text-xs text-red-700">{error}</p>
              <button
                onClick={() => fetchBusinesses()}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar
              </button>
            </div>
          )}

          {/* Estado Vacío */}
          {!loading && !error && businesses.length === 0 && (
            <div className="my-8 rounded-xl border border-line bg-white p-6 text-center">
              <Store className="mx-auto h-10 w-10 text-muted opacity-60" />
              <h3 className="mt-3 text-sm font-black text-slate-900">
                {search || selectedCategory !== "Todos"
                  ? "No encontramos coincidencias"
                  : tab === "member"
                  ? "Aún no eres miembro de ningún comercio"
                  : "No hay comercios disponibles"}
              </h3>
              <p className="mt-1 text-xs text-muted">
                {search || selectedCategory !== "Todos"
                  ? "Prueba con otro término de búsqueda o selecciona otra categoría."
                  : tab === "member"
                  ? "Explora la pestaña 'Explorar todos' o escanea el QR en un comercio para unirte."
                  : "Pronto se sumarán más comercios en tu zona."}
              </p>
              {(search || selectedCategory !== "Todos") && (
                <button
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("Todos");
                    setPage(1);
                  }}
                  className="mt-4 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  Restablecer filtros
                </button>
              )}
            </div>
          )}

          {/* Lista de Comercios */}
          {!loading && !error && businesses.length > 0 && (
            <div className="space-y-3">
              {businesses.map((business) => {
                const IconComponent = getCategoryIcon(business.category);
                const href = business.slug === "cafe-central" ? "/c/cafe-central" : `/c/comercios`;

                return (
                  <Link
                    key={business.id}
                    href={href}
                    className="block rounded-xl border border-line bg-white p-4 shadow-sm transition-all hover:border-brand-300"
                  >
                    <div className="flex gap-3">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                        <IconComponent className="h-6 w-6" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-black text-slate-900 truncate">{business.name}</p>
                            <p className="text-xs text-muted truncate">{business.category}</p>
                          </div>
                          {business.isMember ? (
                            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-black text-amber-700 border border-amber-200">
                              <Star className="mr-1 inline h-3 w-3 text-amber-500" />
                              {business.points} pts
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                              No miembro
                            </span>
                          )}
                        </div>

                        {business.description && (
                          <p className="mt-1.5 text-xs text-slate-600 line-clamp-1">{business.description}</p>
                        )}

                        <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                          <span className="flex items-center gap-1 text-muted truncate max-w-[180px]">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {business.address || business.distance}
                          </span>
                          <span className="font-bold text-emerald-700 shrink-0">
                            {business.benefit}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}

              {/* Controles de Paginación */}
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 px-1">
                <span className="text-xs text-muted">
                  Página <strong className="text-slate-900">{pagination.page}</strong> de{" "}
                  <strong className="text-slate-900">{pagination.totalPages}</strong> ({pagination.total} comercios)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1 || loading}
                    aria-label="Página anterior"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-slate-700 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!pagination.hasNext || loading}
                    aria-label="Página siguiente"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-slate-700 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <CustomerBottomNav active="Comercios" />
      </div>
    </main>
  );
}
