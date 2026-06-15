import Link from "next/link";
import { Coffee, MapPin, Search, Scissors, Star, Store, Waves } from "lucide-react";
import { CustomerBottomNav } from "@/components/customer-bottom-nav";

const businesses = [
  { name: "Cafe Central", category: "Cafeteria", distance: "350 m", benefit: "$5.000 credito", points: "120 pts", icon: Coffee, href: "/c/cafe-central" },
  { name: "Barberia Norte", category: "Barberia", distance: "800 m", benefit: "15% descuento", points: "80 pts", icon: Scissors, href: "#" },
  { name: "Green Wash", category: "Lavadero", distance: "1.2 km", benefit: "Puntos dobles", points: "45 pts", icon: Waves, href: "#" },
  { name: "Local Market", category: "Tienda", distance: "1.6 km", benefit: "50 pts bienvenida", points: "Nuevo", icon: Store, href: "#" }
];

export default function ComerciosPage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 shadow-soft">
        <header className="bg-white px-5 pb-5 pt-8">
          <h1 className="text-2xl font-black">Comercios</h1>
          <p className="mt-1 text-sm text-muted">Tus clubes y negocios cerca de ti</p>
          <div className="mt-5 flex items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 py-2">
            <Search className="h-4 w-4 text-muted" />
            <span className="text-sm text-muted">Buscar por nombre o categoria</span>
          </div>
        </header>
        <section className="flex flex-1 flex-col gap-3 p-4 pb-24">
          {businesses.map((business) => (
            <Link key={business.name} href={business.href} className="rounded-lg border border-line bg-white p-4">
              <div className="flex gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <business.icon className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{business.name}</p>
                      <p className="text-sm text-muted">{business.category}</p>
                    </div>
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                      <Star className="mr-1 inline h-3 w-3" />
                      {business.points}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-muted"><MapPin className="h-3 w-3" /> {business.distance}</span>
                    <span className="font-bold text-emerald-700">{business.benefit}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </section>
        <CustomerBottomNav active="Comercios" />
      </div>
    </main>
  );
}
