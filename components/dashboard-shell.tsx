"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Gift,
  Home,
  LogOut,
  Megaphone,
  QrCode,
  ScanLine,
  Settings,
  Store,
  Target,
  Users
} from "lucide-react";
import { LoyLoopLogo } from "@/components/loyloop-logo";
import { supabase } from "@/lib/supabase/client";

const navGroups = [
  {
    label: "Vista general",
    items: [
      { label: "Inicio", href: "/dashboard", icon: Home },
      { label: "Analíticas", href: "/dashboard/analiticas", icon: BarChart3 },
      { label: "Clientes", href: "/dashboard/clientes", icon: Users }
    ]
  },
  {
    label: "Fidelización",
    items: [
      { label: "Recompensas", href: "/dashboard/recompensas", icon: Gift },
      { label: "Misiones", href: "/dashboard/misiones", icon: Target },
      { label: "Campañas", href: "/dashboard/campanas", icon: Megaphone }
    ]
  },
  {
    label: "Operación",
    items: [
      { label: "Validar QR", href: "/dashboard/validar", icon: ScanLine },
      { label: "QR del comercio", href: "/dashboard/qr", icon: QrCode },
      { label: "Solicitudes", href: "/dashboard/solicitudes", icon: ClipboardList },
      { label: "Configuración", href: "/dashboard/configuracion", icon: Settings }
    ]
  }
];

const navItems = navGroups.flatMap((group) => group.items);

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <main className="admin-shell text-ink">
      <div className="grid min-h-screen lg:grid-cols-[272px_minmax(0,1fr)]">
        <aside className="admin-sidebar sticky top-0 hidden h-screen flex-col border-r border-[#F5CED3] lg:flex">
          <Link href="/dashboard" className="flex h-20 items-center border-b border-[#F5CED3] px-6" aria-label="LoyLoop, ir al inicio">
            <LoyLoopLogo />
          </Link>

          <nav className="flex-1 space-y-7 overflow-y-auto px-4 py-7" aria-label="Navegación de administración">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-[#9F6873]">{group.label}</p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[13px] font-semibold transition ${
                          active
                            ? "bg-brand-600 text-white shadow-[0_8px_18px_rgba(250,64,89,.22)]"
                            : "text-[#45506A] hover:bg-white/75 hover:text-brand-700"
                        }`}
                      >
                        <item.icon className="h-[18px] w-[18px] stroke-[1.8]" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-[#F5CED3] p-4">
            <div className="rounded-[20px] border border-[#F8BEC8] bg-gradient-to-br from-[#FFF4EB] via-[#FFE5E4] to-[#FFD2DC] p-4 shadow-[0_8px_20px_rgba(180,78,91,.08)]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-brand-600 shadow-sm">
                <Store className="h-5 w-5" />
              </div>
              <p className="text-sm font-bold">Tu comercio, más cerca</p>
              <p className="mt-1 text-xs leading-5 text-muted">Acompaña cada visita con beneficios que invitan a volver.</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur-md">
            <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <Link href="/dashboard" className="lg:hidden" aria-label="LoyLoop, ir al inicio">
                <LoyLoopLogo />
              </Link>
              <div className="hidden items-center gap-3 lg:flex">
                <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-brand-50 text-brand-600">
                  <Store className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold">Café Central</p>
                  <p className="text-xs text-muted">Panel del comercio</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  href="/dashboard/qr"
                  className="hidden items-center gap-2 rounded-[14px] border border-brand-100 bg-brand-50 px-3.5 py-2.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 sm:inline-flex"
                >
                  <QrCode className="h-4 w-4" />
                  QR del comercio
                </Link>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-xs font-bold text-white shadow-[0_5px_14px_rgba(250,64,89,.2)]" aria-label="Café Central">
                  CC
                </span>
                <button
                  className="grid h-10 w-10 place-items-center rounded-[14px] border border-line bg-white text-muted transition hover:border-brand-100 hover:text-brand-700"
                  onClick={signOut}
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-[18px] w-[18px]" />
                </button>
              </div>
            </div>
            <nav className="flex gap-1 overflow-x-auto border-t border-brand-100 bg-[#FFF0F2] px-3 py-2 lg:hidden" aria-label="Navegación de administración móvil">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                      active ? "bg-brand-600 text-white shadow-[0_4px_10px_rgba(250,64,89,.18)]" : "text-[#765E70]"
                    }`}
                  >
                    <item.icon className="h-4 w-4 stroke-[1.8]" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>
          <div className="admin-content p-4 sm:p-6 lg:p-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
