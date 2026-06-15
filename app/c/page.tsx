import Link from "next/link";
import { Coffee, Gift, Search, Sparkles, Store, UserRound, Waves, Scissors } from "lucide-react";
import { CustomerBottomNav } from "@/components/customer-bottom-nav";
import { getCustomerBusinessesForDemo } from "@/lib/data/demo";

const joinedBusinesses = [
  { name: "Cafe Central", category: "Cafeteria", points: 120, credit: "$5.000", href: "/c/cafe-central", icon: Coffee },
  { name: "Barberia Norte", category: "Barberia", points: 80, credit: "15% off", href: "/c/comercios", icon: Scissors },
  { name: "Green Wash", category: "Lavadero", points: 45, credit: "2x puntos", href: "/c/comercios", icon: Waves }
];

const nearbyBusinesses = [
  ["Sushi 45", "Restaurante", "Credito de bienvenida"],
  ["FitBox", "Gimnasio", "Pase gratis"],
  ["Pet Vida", "Veterinaria", "10% primera visita"]
];

export default async function CustomerHubPage() {
  const supabaseBusinesses = await getCustomerBusinessesForDemo();
  const businesses = supabaseBusinesses.length
    ? supabaseBusinesses.map((business, index) => ({
        ...business,
        icon: [Coffee, Scissors, Waves][index] ?? Store
      }))
    : joinedBusinesses;

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 shadow-soft">
        <header className="bg-white px-5 pb-5 pt-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-muted">Hola, Juan</p>
              <h1 className="mt-1 text-2xl font-black">Tus comercios</h1>
            </div>
            <div className="grid h-11 w-11 place-items-center rounded-full bg-brand-50 text-brand-700">
              <UserRound className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 py-2">
            <Search className="h-4 w-4 text-muted" />
            <span className="text-sm text-muted">Buscar beneficios o comercios</span>
          </div>
        </header>

        <section className="flex flex-1 flex-col gap-5 p-4 pb-24">
          <div className="rounded-lg bg-brand-500 p-4 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <p className="font-black">Escanea un QR para unirte a un nuevo comercio</p>
            </div>
            <p className="mt-2 text-sm text-blue-100">Cada negocio tiene sus propias recompensas, misiones y creditos.</p>
          </div>

          <section>
            <h2 className="mb-3 text-sm font-black">Comercios donde ya estas registrado</h2>
            <div className="space-y-3">
              {businesses.map((business) => (
                <Link key={business.name} href={business.href} className="block rounded-lg border border-line bg-white p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-lg bg-brand-50 text-brand-600">
                      <business.icon className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black">{business.name}</p>
                      <p className="text-sm text-muted">{business.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-brand-700">{business.points} pts</p>
                      <p className="text-xs text-emerald-700">{business.credit}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-black">Descubre cerca de ti</h2>
            <div className="grid gap-3">
              {nearbyBusinesses.map(([name, category, benefit]) => (
                <div key={name} className="rounded-lg border border-line bg-white p-4">
                  <p className="font-black">{name}</p>
                  <p className="text-sm text-muted">{category}</p>
                  <p className="mt-2 text-sm font-bold text-emerald-700">{benefit}</p>
                </div>
              ))}
            </div>
          </section>
        </section>

        <CustomerBottomNav active="Inicio" />
      </div>
    </main>
  );
}
