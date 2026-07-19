import { CreditCard, Save, ShieldCheck, Store, Wallet } from "lucide-react";
import { createBusinessUser, updateAppUserRole, updateBusinessSegmentationRules } from "@/lib/actions/app-users";
import { getAppUsers } from "@/lib/data/app-users";
import { getBusinessSettings } from "@/lib/data/dashboard";

const businessRoles = [
  { value: "owner", label: "Duenio" },
  { value: "manager", label: "Administrador" },
  { value: "cashier", label: "Cajero" }
];

export default async function ConfiguracionPage() {
  const users = await getAppUsers();
  const businessSettings = await getBusinessSettings();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Configuracion</h1>
          <p className="mt-1 text-muted">Informacion del comercio, usuarios, roles y pagos</p>
        </div>
        <button className="btn-primary"><Save className="h-4 w-4" /> Guardar cambios</button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        <div className="grid gap-6">
          <div className="rounded-lg border border-line bg-white p-5">
            <div className="mb-5 flex items-center gap-3">
              <Store className="h-5 w-5 text-brand-500" />
              <h2 className="font-black">Datos del comercio</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["Nombre", "Cafe Central"],
                ["Categoria", "Cafeteria"],
                ["Direccion", "Cra. 7 #45-12, Bogota"],
                ["Telefono", "+57 300 123 4567"]
              ].map(([label, value]) => (
                <label key={label} className="grid gap-1 text-sm font-bold">
                  {label}
                  <input className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal" defaultValue={value} />
                </label>
              ))}
            </div>
          </div>

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
              El duenio crea aqui administradores y cajeros del comercio. Para login real, ese correo tambien debe existir en Supabase Auth.
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
