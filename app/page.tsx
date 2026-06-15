"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Coffee,
  Copy,
  Crown,
  Download,
  Gift,
  Home,
  Megaphone,
  Menu,
  MessageCircle,
  QrCode,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Trophy,
  UserRound,
  Users,
  Wallet,
  Zap
} from "lucide-react";
import { useState } from "react";

const stats = [
  { label: "Clientes registrados", value: "1.248", change: "+18%", icon: Users },
  { label: "Visitas este mes", value: "3.912", change: "+24%", icon: Store },
  { label: "Recompensas redimidas", value: "486", change: "+31%", icon: Gift },
  { label: "Creditos entregados", value: "$2.4M", change: "+12%", icon: CircleDollarSign }
];

const activities = [
  ["Laura M.", "Café Central", "+20 puntos", "Hace 4 min"],
  ["Andres P.", "Barberia Norte", "Redimio corte", "Hace 12 min"],
  ["Sofia R.", "Green Wash", "+$5.000 credito", "Hace 23 min"],
  ["Mateo C.", "Café Central", "Invito amigo", "Hace 41 min"]
];

const campaigns = [
  { name: "Puntos dobles en la tarde", status: "Activa", reward: "2x puntos", color: "bg-brand-50 text-brand-700" },
  { name: "Trae un amigo", status: "Activa", reward: "$5.000 credito", color: "bg-emerald-50 text-emerald-700" },
  { name: "Hora tranquila", status: "Programada", reward: "15% descuento", color: "bg-amber-50 text-amber-700" }
];

const rewards = [
  ["Café gratis", "10 sellos", "Activo", "312 redenciones"],
  ["15% en proxima visita", "60 puntos", "Activo", "198 redenciones"],
  ["Credito de bienvenida", "$5.000", "Activo", "421 entregados"]
];

const missionTemplates = [
  { title: "Frecuencia", text: "Compra 2 veces esta semana", icon: Trophy },
  { title: "Referidos", text: "Invita a un amigo nuevo", icon: Users },
  { title: "Horas valle", text: "Visita antes de las 12 p.m.", icon: Zap },
  { title: "MiniPay", text: "Paga y desbloquea cashback", icon: Wallet },
  { title: "Resena", text: "Deja una opinion verificada", icon: MessageCircle }
];

const navItems = [
  { label: "Inicio", href: "/dashboard", icon: Home },
  { label: "Clientes", href: "/dashboard/clientes", icon: Users },
  { label: "Recompensas", href: "/dashboard/recompensas", icon: Gift },
  { label: "Misiones", href: "/dashboard/misiones", icon: ClipboardList },
  { label: "Campañas", href: "/dashboard/campanas", icon: Megaphone },
  { label: "QR del comercio", href: "/dashboard/qr", icon: QrCode },
  { label: "Analíticas", href: "/dashboard/analiticas", icon: ChartNoAxesCombined },
  { label: "Configuración", href: "/dashboard/configuracion", icon: Settings }
];

function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 text-white">
        <RefreshLoop />
      </div>
      <span className={`text-xl font-black tracking-normal ${inverse ? "text-white" : "text-ink"}`}>LoyLoop</span>
    </div>
  );
}

function RefreshLoop() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M7.2 8.2a5.4 5.4 0 0 1 8.5-.9L18 9.5M18 9.5V5.6M18 9.5h-3.9M16.8 15.8a5.4 5.4 0 0 1-8.5.9L6 14.5M6 14.5v3.9M6 14.5h3.9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="chip">{children}</span>;
}

export default function HomePage() {
  const [activePanel, setActivePanel] = useState<"dashboard" | "customer">("dashboard");

  return (
    <main className="min-h-screen bg-cloud">
      <header className="sticky top-0 z-40 border-b border-line bg-white/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Logo inverse />
          <nav className="hidden items-center gap-6 text-sm font-semibold text-muted md:flex">
            <a href="#producto" className="hover:text-ink">Producto</a>
            <a href="#dashboard" className="hover:text-ink">Dashboard</a>
            <a href="#cliente" className="hover:text-ink">Cliente</a>
            <a href="#planes" className="hover:text-ink">Planes</a>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Link href="/login" className="btn-ghost">Entrar</Link>
            <Link href="/dashboard" className="btn-primary">Crear comercio <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <button className="btn-secondary md:hidden" aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center">
            <SectionLabel><Sparkles className="h-3.5 w-3.5 text-points" /> Fidelizacion para comercios locales</SectionLabel>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-normal text-ink sm:text-5xl lg:text-6xl">
              Convierte visitas en clientes que vuelven
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
              Crea programas de recompensas, misiones, descuentos y creditos promocionales con un QR. LoyLoop ayuda a que cada compra abra una nueva razon para regresar.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard" className="btn-primary px-5 py-3">Crear mi comercio <Store className="h-4 w-4" /></Link>
              <Link href="/c/cafe-central" className="btn-secondary px-5 py-3">Ver demo <ScanLine className="h-4 w-4" /></Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["QR sin friccion", "Misiones y referidos", "Preparado para MiniPay"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm font-semibold text-muted">
                  <Check className="h-4 w-4 text-reward" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_0.72fr]">
            <div className="panel p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase text-muted">Café Central</p>
                  <h2 className="mt-1 text-xl font-black text-ink">Panel de recompensas</h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Activo</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {stats.slice(0, 4).map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-line bg-cloud p-3">
                    <stat.icon className="h-4 w-4 text-brand-500" />
                    <p className="mt-3 text-2xl font-black text-ink">{stat.value}</p>
                    <p className="mt-1 text-xs text-muted">{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-line p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-bold text-ink">Campanas activas</p>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </div>
                <div className="space-y-3">
                  {campaigns.map((campaign) => (
                    <div key={campaign.name} className="flex items-center justify-between rounded-lg bg-cloud px-3 py-2">
                      <span className="text-sm font-semibold text-ink">{campaign.name}</span>
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${campaign.color}`}>{campaign.reward}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <CustomerPhone />
          </div>
        </div>
      </section>

      <section id="producto" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <SectionLabel><BadgeCheck className="h-3.5 w-3.5 text-brand-500" /> Como funciona</SectionLabel>
            <h2 className="mt-4 text-3xl font-black text-ink">Un loop simple para cada comercio</h2>
          </div>
          <p className="max-w-xl text-muted">El cliente escanea, entra al club del comercio, cumple acciones y vuelve para usar sus beneficios.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Crea tu QR", QrCode],
            ["Clientes escanean", ScanLine],
            ["Ganan beneficios", Gift],
            ["Vuelven a comprar", RefreshLoop]
          ].map(([title, Icon], index) => (
            <div key={String(title)} className="panel p-5">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                {typeof Icon === "function" ? <Icon /> : null}
              </div>
              <p className="text-sm font-bold text-muted">Paso {index + 1}</p>
              <h3 className="mt-1 text-lg font-black text-ink">{String(title)}</h3>
            </div>
          ))}
        </div>
      </section>

      <section id="dashboard" className="border-y border-line bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <SectionLabel><Store className="h-3.5 w-3.5 text-reward" /> Vista del comercio</SectionLabel>
              <h2 className="mt-4 text-3xl font-black text-ink">Controla clientes, recompensas y campañas</h2>
            </div>
            <div className="flex rounded-lg border border-line bg-cloud p-1">
              <button onClick={() => setActivePanel("dashboard")} className={`rounded-md px-4 py-2 text-sm font-bold ${activePanel === "dashboard" ? "bg-white text-brand-700 shadow-sm" : "text-muted"}`}>Dashboard</button>
              <button onClick={() => setActivePanel("customer")} className={`rounded-md px-4 py-2 text-sm font-bold ${activePanel === "customer" ? "bg-white text-brand-700 shadow-sm" : "text-muted"}`}>Cliente</button>
            </div>
          </div>
          {activePanel === "dashboard" ? <MerchantDashboard /> : <CustomerExperience />}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8">
        <RewardsManager />
        <MissionsManager />
      </section>

      <section id="cliente" className="border-y border-line bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <SectionLabel><ScanLine className="h-3.5 w-3.5 text-brand-500" /> Despues del QR</SectionLabel>
            <h2 className="mt-4 text-3xl font-black text-ink">Cada escaneo crea una relacion</h2>
            <p className="mt-4 text-muted">La pantalla del cliente muestra su estado en el comercio, beneficios activos, misiones y una accion de pago lista para integrar MiniPay.</p>
            <div className="mt-6 grid gap-3">
              {["Credito de bienvenida", "Misiones personalizadas", "Recompensas por referidos", "Pago con MiniPay"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg border border-line bg-cloud p-3 text-sm font-bold text-ink">
                  <Check className="h-4 w-4 text-reward" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="grid place-items-center">
            <CustomerPhone large />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <QrPoster />
      </section>

      <section id="planes" className="bg-ink py-14 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-bold text-white/70">Planes</span>
            <h2 className="mt-4 text-3xl font-black">Empieza gratis, escala cuando veas clientes volver</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Free", "$0", "QR, sellos y beneficios basicos"],
              ["Pro", "$19/mes", "Campanas, misiones y referidos"],
              ["Growth", "$49/mes", "Analiticas, red local y automatizaciones"]
            ].map(([name, price, text]) => (
              <div key={name} className="rounded-lg border border-white/12 bg-white/8 p-6">
                <h3 className="text-xl font-black">{name}</h3>
                <p className="mt-3 text-3xl font-black">{price}</p>
                <p className="mt-3 text-sm leading-6 text-white/70">{text}</p>
                <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-ink">
                  Elegir plan <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function MerchantDashboard() {
  return (
    <div className="panel max-w-full overflow-hidden">
      <div className="grid min-w-0 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-line bg-ink p-4 text-white lg:border-b-0 lg:border-r">
          <Logo inverse />
          <nav className="mt-6 space-y-1">
            {navItems.map((item, index) => (
              <Link key={item.label} href={item.href} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${index === 0 ? "bg-white text-ink" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 bg-cloud">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white p-4">
            <div>
              <p className="text-sm font-bold text-muted">Café Central</p>
              <h3 className="text-xl font-black text-ink">Inicio</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-lg border border-line bg-cloud px-3 py-2 md:flex">
                <Search className="h-4 w-4 text-muted" />
                <span className="text-sm text-muted">Buscar cliente</span>
              </div>
              <button className="btn-secondary px-3" aria-label="Notificaciones"><Bell className="h-4 w-4" /></button>
              <Link href="/dashboard/configuracion" className="btn-secondary px-3" aria-label="Perfil"><UserRound className="h-4 w-4" /></Link>
            </div>
          </div>
          <div className="grid gap-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-line bg-white p-4">
                  <div className="flex items-center justify-between">
                    <stat.icon className="h-5 w-5 text-brand-500" />
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{stat.change}</span>
                  </div>
                  <p className="mt-4 text-2xl font-black text-ink">{stat.value}</p>
                  <p className="text-sm text-muted">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="rounded-lg border border-line bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="font-black text-ink">Actividad reciente</h4>
                  <Link href="/dashboard/clientes" className="btn-ghost">Ver todo</Link>
                </div>
                <div className="min-w-0 overflow-hidden">
                  <table className="w-full table-fixed text-left text-sm">
                    <thead className="text-xs uppercase text-muted">
                      <tr>
                        <th className="py-3 pr-3">Cliente</th>
                        <th className="hidden pr-3 md:table-cell">Comercio</th>
                        <th className="pr-3">Evento</th>
                        <th className="pr-3">Tiempo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {activities.map(([client, business, event, time]) => (
                        <tr key={`${client}-${event}`}>
                          <td className="truncate py-3 pr-3 font-semibold text-ink">{client}</td>
                          <td className="hidden truncate py-3 pr-3 font-semibold text-ink md:table-cell">{business}</td>
                          <td className="truncate py-3 pr-3 font-semibold text-ink">{event}</td>
                          <td className="truncate py-3 pr-3 font-semibold text-ink">{time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="rounded-lg border border-line bg-white p-4">
                <h4 className="font-black text-ink">QR del comercio</h4>
                <div className="mt-4 grid place-items-center rounded-lg border border-dashed border-brand-100 bg-brand-50 p-8">
                  <QrCode className="h-28 w-28 text-brand-600" />
                </div>
                <Link href="/dashboard/qr" className="btn-primary mt-4 w-full"><Download className="h-4 w-4" /> Descargar QR</Link>
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              {campaigns.map((campaign) => (
                <div key={campaign.name} className="rounded-lg border border-line bg-white p-4">
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${campaign.color}`}>{campaign.status}</span>
                  <h4 className="mt-3 font-black text-ink">{campaign.name}</h4>
                  <p className="mt-1 text-sm text-muted">{campaign.reward}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomerPhone({ large = false }: { large?: boolean }) {
  return (
    <div className={`${large ? "w-full max-w-[390px]" : "w-full"} rounded-[28px] border-[10px] border-ink bg-ink shadow-soft`}>
      <div className="rounded-[18px] bg-cloud p-3">
        <div className="rounded-lg bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-amber-50 text-points">
              <Coffee className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-ink">Café Central</p>
              <p className="text-sm text-muted">Café · Laureles</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-brand-500 p-4 text-white">
            <p className="text-sm font-semibold text-white/80">Te uniste a Café Central</p>
            <p className="mt-1 text-3xl font-black">120 puntos</p>
          </div>
          <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-xs font-bold uppercase text-emerald-700">Credito activo</p>
            <p className="mt-1 text-lg font-black text-emerald-900">$5.000 para tu proxima compra</p>
          </div>
          <div className="mt-4 space-y-2">
            {["Café gratis con 10 sellos", "15% de descuento en tu proxima visita"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-lg border border-line p-3">
                <span className="text-sm font-bold text-ink">{item}</span>
                <Gift className="h-4 w-4 text-reward" />
              </div>
            ))}
          </div>
          <div className="mt-4">
            <p className="mb-2 text-sm font-black text-ink">Misiones</p>
            <div className="grid gap-2">
              {["Compra 2 veces esta semana", "Invita a un amigo", "Paga con MiniPay"].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-lg bg-cloud p-2 text-xs font-bold text-ink">
                  <Star className="h-3.5 w-3.5 text-points" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn-primary py-2 text-xs">Recompensas</button>
            <button className="btn-secondary py-2 text-xs"><Wallet className="h-3.5 w-3.5" /> MiniPay</button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1 rounded-lg bg-white p-2 text-[10px] font-bold text-muted">
          {[Home, Store, ScanLine, Gift, UserRound].map((Icon, index) => (
            <div key={index} className={`grid place-items-center gap-1 rounded-md py-1 ${index === 2 ? "bg-brand-50 text-brand-600" : ""}`}>
              <Icon className="h-4 w-4" />
              {["Inicio", "Locales", "Scan", "Premios", "Perfil"][index]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CustomerExperience() {
  return (
    <div className="grid gap-6 rounded-lg border border-line bg-cloud p-4 lg:grid-cols-[0.75fr_1.25fr]">
      <CustomerPhone large />
      <div className="grid content-center gap-4">
        {[
          ["Registro instantaneo", "El cliente queda unido al comercio despues de escanear.", ShieldCheck],
          ["Beneficio inmediato", "Credito, descuento o puntos para que el primer escaneo tenga valor.", Gift],
          ["Misiones que mueven demanda", "Referidos, horas valle y pagos con MiniPay.", Megaphone]
        ].map(([title, text, Icon]) => (
          <div key={String(title)} className="rounded-lg border border-line bg-white p-5">
            <Icon className="h-5 w-5 text-brand-500" />
            <h3 className="mt-3 font-black text-ink">{String(title)}</h3>
            <p className="mt-1 text-sm leading-6 text-muted">{String(text)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RewardsManager() {
  return (
    <div className="panel p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <SectionLabel><Gift className="h-3.5 w-3.5 text-reward" /> Recompensas</SectionLabel>
          <h2 className="mt-3 text-2xl font-black text-ink">Crea beneficios faciles de redimir</h2>
        </div>
        <button className="btn-primary hidden sm:inline-flex">Nueva <Gift className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {["Nombre", "Tipo", "Condicion", "Vence"].map((field) => (
          <label key={field} className="grid gap-1 text-sm font-bold text-ink">
            {field}
            <input className="rounded-lg border border-line bg-cloud px-3 py-2 font-normal outline-none focus:border-brand-500" placeholder={field === "Nombre" ? "Ej. Café gratis" : "Seleccionar"} />
          </label>
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {rewards.map(([name, condition, status, detail]) => (
          <div key={name} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3">
            <div>
              <p className="font-black text-ink">{name}</p>
              <p className="text-sm text-muted">{condition} · {detail}</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MissionsManager() {
  return (
    <div className="panel p-5">
      <div className="mb-5">
        <SectionLabel><ClipboardList className="h-3.5 w-3.5 text-points" /> Misiones</SectionLabel>
        <h2 className="mt-3 text-2xl font-black text-ink">Activa acciones que traen clientes</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {missionTemplates.map((mission) => (
          <button key={mission.title} className="rounded-lg border border-line bg-cloud p-4 text-left transition hover:border-brand-100 hover:bg-brand-50">
            <mission.icon className="h-5 w-5 text-brand-500" />
            <p className="mt-3 font-black text-ink">{mission.title}</p>
            <p className="mt-1 text-sm text-muted">{mission.text}</p>
          </button>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-line bg-white p-4">
        <p className="font-black text-ink">Mision activa</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-ink">Compra 2 veces esta semana</p>
            <p className="text-sm text-muted">Recompensa: 40 puntos extra</p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">En curso</span>
        </div>
      </div>
    </div>
  );
}

function QrPoster() {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="panel p-6">
        <SectionLabel><QrCode className="h-3.5 w-3.5 text-brand-500" /> QR del comercio</SectionLabel>
        <h2 className="mt-4 text-3xl font-black text-ink">Listo para poner en caja</h2>
        <p className="mt-3 text-muted">Tus clientes escanean el codigo, se unen al comercio y desbloquean beneficios al instante.</p>
        <div className="mt-6 grid max-w-md place-items-center rounded-lg border border-dashed border-brand-100 bg-brand-50 p-8">
          <QrCode className="h-36 w-36 text-brand-700" />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button className="btn-primary"><Download className="h-4 w-4" /> Descargar QR</button>
          <button className="btn-secondary"><Copy className="h-4 w-4" /> Copiar enlace</button>
        </div>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <div className="grid min-h-[420px] place-items-center rounded-lg bg-brand-500 p-8 text-center text-white">
          <div className="max-w-sm">
            <div className="mx-auto grid h-28 w-28 place-items-center rounded-lg bg-white text-brand-600">
              <QrCode className="h-20 w-20" />
            </div>
            <h3 className="mt-6 text-3xl font-black">Escanea y gana</h3>
            <p className="mt-3 text-white/82">Unete al club de Café Central, recibe credito de bienvenida y completa misiones.</p>
            <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-brand-700">
              <Crown className="h-4 w-4" />
              Powered by LoyLoop
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
