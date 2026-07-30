import { Calendar, Gift, Pencil, Plus, Trash2 } from "lucide-react";
import { createReward, deleteReward, updateReward } from "@/lib/actions/loyalty";
import { getDashboardRewards } from "@/lib/data/dashboard";

const segments = [
  { value: "inactive", label: "Inactivo" },
  { value: "at_risk", label: "En riesgo" },
  { value: "active", label: "Activo" },
  { value: "vip", label: "VIP" }
];

export default async function RecompensasPage() {
  const rewards = await getDashboardRewards();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Recompensas</h1>
          <p className="mt-1 text-muted">Disena beneficios que tus clientes quieran redimir</p>
        </div>
        <a href="#nueva-recompensa" className="btn-primary">
          <Plus className="h-4 w-4" /> Crear recompensa
        </a>
      </div>

      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <form id="nueva-recompensa" action={createReward} className="rounded-lg border border-line bg-white p-5">
          <h2 className="font-black">Nueva recompensa</h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-1 text-sm font-bold">
              Nombre
              <input name="name" className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" placeholder="Ej. Cafe gratis" />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Tipo
              <select name="type" className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500">
                <option value="product">Producto gratis</option>
                <option value="discount">Descuento</option>
                <option value="credit">Credito</option>
                <option value="points">Puntos</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Tipo de cliente
              <select name="audience_segment" defaultValue="active" className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500">
                {segments.map((segment) => (
                  <option key={segment.value} value={segment.value}>{segment.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Puntos requeridos
              <input name="points_required" type="number" min="0" className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" placeholder="Ej. 200" />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Credito en centavos
              <input name="credit_amount_cents" type="number" min="0" className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" placeholder="Ej. 500000" />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Descripcion
              <textarea name="description" className="min-h-24 rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" placeholder="Condiciones del beneficio" />
            </label>
            <button className="btn-primary">Guardar recompensa</button>
          </div>
        </form>

        <div className="grid gap-4 md:grid-cols-2">
          {rewards.map((reward) => (
            <div key={reward.id} className="rounded-lg border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                    <Gift className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black">{reward.name}</h3>
                    <p className="mt-1 text-sm text-muted">{reward.type} - {reward.requirement}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${reward.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {reward.active ? "Activa" : "Pausada"}
                  </span>
                  <form action={deleteReward}>
                    <input type="hidden" name="id" value={reward.id} />
                    <button className="grid h-9 w-9 place-items-center rounded-lg border border-line text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600" aria-label={`Eliminar ${reward.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-muted">{reward.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-muted">Usuario</p>
                  <p className="mt-1 font-black">{reward.audience}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="flex items-center gap-2 text-xs text-muted">
                    <Calendar className="h-4 w-4" /> Redenciones
                  </p>
                  <p className="mt-1 text-xl font-black">{reward.redeemed}</p>
                </div>
              </div>

              <details className="mt-4 border-t border-line pt-4">
                <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700">
                  <Pencil className="h-4 w-4" />
                  Editar
                </summary>
                <form action={updateReward} className="mt-4 grid gap-3">
                  <input type="hidden" name="id" value={reward.id} />
                  <input
                    name="name"
                    defaultValue={reward.name}
                    className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm"
                    aria-label="Nombre de recompensa"
                  />
                  <select name="type" defaultValue={reward.typeValue} className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm">
                    <option value="product">Producto gratis</option>
                    <option value="discount">Descuento</option>
                    <option value="credit">Credito</option>
                    <option value="points">Puntos</option>
                  </select>
                  <select name="audience_segment" defaultValue={reward.audienceSegment} className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm">
                    {segments.map((segment) => (
                      <option key={segment.value} value={segment.value}>{segment.label}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      name="points_required"
                      type="number"
                      min="0"
                      defaultValue={reward.pointsRequired || ""}
                      className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm"
                      placeholder="Puntos"
                    />
                    <input
                      name="credit_amount_cents"
                      type="number"
                      min="0"
                      defaultValue={reward.creditAmountCents || ""}
                      className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm"
                      placeholder="Credito"
                    />
                  </div>
                  <textarea
                    name="description"
                    defaultValue={reward.description}
                    className="min-h-20 rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm"
                    aria-label="Descripcion de recompensa"
                  />
                  <button className="btn-secondary text-xs">
                    Guardar cambios
                  </button>
                </form>
              </details>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
