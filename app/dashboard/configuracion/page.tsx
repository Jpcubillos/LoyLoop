import { CreditCard, Save, ShieldCheck, Sparkles, Store, Wallet } from "lucide-react";
import { createBusinessUser, updateAppUserRole, updateBusinessSegmentationRules, updateBusinessProfile, updateBusinessAwardRules } from "@/lib/actions/app-users";
import { getAppUsers } from "@/lib/data/app-users";
import { getBusinessSettings, getCafeCentral, getBusinessAwardRules } from "@/lib/data/dashboard";

const businessRoles = [
  { value: "owner", label: "Dueño" },
  { value: "manager", label: "Administrador" },
  { value: "cashier", label: "Cajero" }
];

export default async function ConfiguracionPage() {
  const users = await getAppUsers();
  const businessSettings = await getBusinessSettings();
  const business = await getCafeCentral();
  const awardRules = await getBusinessAwardRules();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Configuracion</h1>
          <p className="mt-1 text-muted">Informacion del comercio, usuarios, roles y segmentacion</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        <div className="grid gap-6">
          <form action={updateBusinessProfile} className="rounded-lg border border-line bg-white p-5">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-brand-500" />
                <h2 className="font-black">Datos del comercio</h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                Estado: Activo
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-bold">
                Nombre del comercio
                <input
                  name="name"
                  className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal"
                  defaultValue={business?.name ?? "Café Central"}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-bold">
                Categoría
                <input
                  name="category"
                  className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal"
                  defaultValue={business?.category ?? "Cafetería"}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-bold">
                Dirección / Sede principal
                <input
                  name="address"
                  className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal"
                  defaultValue={business?.address ?? "Cra. 7 #45-12"}
                />
              </label>
              <label className="grid gap-1 text-sm font-bold">
                Ciudad
                <input
                  name="city"
                  className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal"
                  defaultValue={business?.city ?? "Bogotá"}
                />
              </label>
            </div>
            <label className="mt-4 grid gap-1 text-sm font-bold">
              Descripción del programa de fidelización
              <textarea
                name="description"
                rows={3}
                className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal text-sm"
                defaultValue={business?.description ?? "Café de especialidad, postres y recompensas para clientes frecuentes."}
              />
            </label>
            <div className="mt-4 flex justify-end">
              <button type="submit" className="btn-primary">
                <Save className="h-4 w-4" /> Guardar datos del comercio
              </button>
            </div>
          </form>

          <form action={updateBusinessAwardRules} className="rounded-lg border border-line bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-amber-600" />
                <h2 className="font-black">Reglas de otorgamiento de puntos y sellos</h2>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                Versión activa: v{awardRules.version}
              </span>
            </div>
            <p className="mb-4 text-xs leading-5 text-muted">
              Configura cuántos puntos de fidelidad y sellos se otorgan al registrar y validar una compra. Los puntos son acumulativos, permanentes y no se consumen ni vencen.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-bold">
                Puntos por compra validada
                <input
                  name="points_per_purchase"
                  type="number"
                  min="0"
                  max="100000"
                  className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal"
                  defaultValue={awardRules.pointsPerPurchase}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-bold">
                Sellos por compra validada
                <input
                  name="stamps_per_purchase"
                  type="number"
                  min="0"
                  max="20"
                  className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal"
                  defaultValue={awardRules.stampsPerPurchase}
                  required
                />
              </label>
            </div>
            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-line bg-slate-50/70 p-3">
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  name="stamps_enabled"
                  type="checkbox"
                  defaultChecked={awardRules.stampsEnabled}
                />
                Otorgar sellos automáticamente en compras validadas
              </label>
              <p className="text-xs text-muted">
                Los sellos se contabilizan de forma separada al saldo de puntos. Al redimir una tarjeta completa, los sellos se reinician pero los puntos históricos se conservan.
              </p>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">
              Los cambios en esta regla incrementan la versión efectiva (v{awardRules.version + 1}) y aplican a eventos futuros sin alterar las transacciones ya emitidas ni el historial.
            </p>
            <div className="mt-4 flex justify-end">
              <button type="submit" className="btn-primary">
                <Save className="h-4 w-4" /> Guardar reglas de otorgamiento
              </button>
            </div>
          </form>

          <div className="rounded-lg border border-line bg-white p-5">
            <div className="mb-5 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-brand-500" />
              <h2 className="font-black">Usuarios y roles</h2>
            </div>
            <form action={createBusinessUser} className="mb-5 grid gap-3 rounded-lg border border-dashed border-brand-200 bg-brand-50/40 p-4 md:grid-cols-[1fr_1fr_180px_auto] md:items-end">
              <label className="grid gap-1 text-xs font-bold text-muted">
                Nombre
                <input name="full_name" className="rounded-lg border border-line bg-white px-3 py-2 font-normal text-ink" placeholder="Ej. Ana Torres" required />
              </label>
              <label className="grid gap-1 text-xs font-bold text-muted">
                Correo
                <input name="email" type="email" className="rounded-lg border border-line bg-white px-3 py-2 font-normal text-ink" placeholder="ana@comercio.com" required />
              </label>
              <label className="grid gap-1 text-xs font-bold text-muted">
                Rol
                <select name="business_role" defaultValue="cashier" className="rounded-lg border border-line bg-white px-3 py-2 font-normal text-ink">
                  {businessRoles.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </label>
              <button className="btn-primary h-10 text-xs">Crear usuario</button>
            </form>
            <p className="mb-4 text-xs leading-5 text-muted">
              El dueños crea aqui administradores y cajeros del comercio. Para login real, ese correo tambien debe existir en Supabase Auth.
            </p>
            <div className="grid gap-3">
              {users.map((user) => (
                <form key={user.id} action={updateAppUserRole} className="grid gap-3 rounded-lg border border-line p-4 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-end">
                  <input type="hidden" name="id" value={user.id} />
                  <div>
                    <p className="font-black">{user.fullName}</p>
                    <p className="text-xs text-muted">{user.email}</p>
                  </div>
                  <label className="grid gap-1 text-xs font-bold text-muted">
                    Tipo
                    <select name="account_type" defaultValue={user.accountType} className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal text-ink">
                      <option value="business">Comercio</option>
                      <option value="customer">Cliente</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-muted">
                    Rol comercio
                    <select name="business_role" defaultValue={user.businessRole ?? "cashier"} className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal text-ink">
                      {businessRoles.map((role) => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm font-bold">
                      <input name="active" type="checkbox" defaultChecked={user.active} />
                      Activo
                    </label>
                    <button className="btn-secondary h-10 text-xs">Guardar</button>
                  </div>
                </form>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <form action={updateBusinessSegmentationRules} className="rounded-lg border border-line bg-white p-5">
            <div className="mb-4 flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-brand-500" />
              <h2 className="font-black">Reglas de clientes</h2>
            </div>
            <label className="grid gap-1 text-sm font-bold">
              Compras para ser VIP
              <input name="vip_purchase_threshold" type="number" min="1" className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal" defaultValue={businessSettings.vipPurchaseThreshold} />
            </label>
            <label className="mt-4 grid gap-1 text-sm font-bold">
              En riesgo despues de
              <div className="flex items-center gap-2">
                <input name="at_risk_days" type="number" min="1" className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal" defaultValue={businessSettings.atRiskDays} />
                <span className="text-sm font-bold text-muted">dias</span>
              </div>
            </label>
            <label className="mt-4 grid gap-1 text-sm font-bold">
              Inactivo despues de
              <div className="flex items-center gap-2">
                <input name="inactive_days" type="number" min="2" className="w-full rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal" defaultValue={businessSettings.inactiveDays} />
                <span className="text-sm font-bold text-muted">dias</span>
              </div>
            </label>
            <p className="mt-3 text-xs leading-5 text-muted">
              El segmento del cliente se calcula por compras y ultima visita. Las campanas y misiones usan estas reglas para decidir a quien aparecen.
            </p>
            <button className="btn-primary mt-4 w-full text-sm">Guardar reglas</button>
          </form>

          <div className="rounded-lg border border-line bg-white p-5">
            <div className="mb-4 flex items-center gap-3">
              <Wallet className="h-5 w-5 text-emerald-600" />
              <h2 className="font-black">MiniPay</h2>
            </div>
            <p className="text-sm text-muted">Conecta una wallet para cashback, creditos y campanas prepagadas.</p>
            <button className="btn-secondary mt-4 w-full">Conectar MiniPay</button>
          </div>
        </div>
      </div>
    </>
  );
}
