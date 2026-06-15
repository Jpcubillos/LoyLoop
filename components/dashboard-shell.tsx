"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Gift,
  Home,
  Megaphone,
  QrCode,
  ScanLine,
  Search,
  Settings,
  Target,
  UserRound,
  Users
} from "lucide-react";

const navItems = [
  { label: "Inicio", href: "/dashboard", icon: Home },
  { label: "Clientes", href: "/dashboard/clientes", icon: Users },
  { label: "Recompensas", href: "/dashboard/recompensas", icon: Gift },
  { label: "Misiones", href: "/dashboard/misiones", icon: Target },
  { label: "Campañas", href: "/dashboard/campanas", icon: Megaphone },
  { label: "Validar QR", href: "/dashboard/validar", icon: ScanLine },
  { label: "QR del comercio", href: "/dashboard/qr", icon: QrCode },
  { label: "Analíticas", href: "/dashboard/analiticas", icon: BarChart3 },
  { label: "Configuración", href: "/dashboard/configuracion", icon: Settings }
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M7.2 8.2a5.4 5.4 0 0 1 8.5-.9L18 9.5M18 9.5V5.6M18 9.5h-3.9M16.8 15.8a5.4 5.4 0 0 1-8.5.9L6 14.5M6 14.5v3.9M6 14.5h3.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-xl font-black text-ink">LoyLoop</span>
    </Link>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-slate-50 text-ink">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-line bg-white lg:flex lg:flex-col">
          <div className="flex h-16 items-center border-b border-line px-6">
            <Logo />
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-3">
            {navItems.map((item) => {
              const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                    active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-ink"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-line p-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-black text-ink">Plan Free</p>
              <p className="mt-1 text-xs text-muted">Activa Pro cuando crezcan tus clientes.</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="flex h-16 items-center justify-between gap-4 border-b border-line bg-white px-4 lg:px-6">
            <div>
              <p className="text-sm font-black">Café Central</p>
              <p className="text-xs text-muted">Panel del comercio</p>
            </div>
            <div className="hidden w-full max-w-sm items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 md:flex">
              <Search className="h-4 w-4 text-muted" />
              <span className="text-sm text-muted">Buscar clientes, recompensas...</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="relative grid h-10 w-10 place-items-center rounded-lg border border-line bg-white">
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
              </button>
              <button className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-sm font-black text-brand-700">
                CC
              </button>
            </div>
          </header>
          <div className="p-4 lg:p-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
