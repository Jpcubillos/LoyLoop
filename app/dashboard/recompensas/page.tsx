import { Calendar, Gift, Plus, ToggleRight } from "lucide-react";
import { createReward } from "@/lib/actions/loyalty";
import { getDashboardRewards } from "@/lib/data/dashboard";

export default async function RecompensasPage() {
  const rewards = await getDashboardRewards();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Recompensas</h1>
          <p className="mt-1 text-muted">Diseña beneficios que tus clientes quieran redimir</p>
        </div>
        <a href="#nueva-recompensa" className="btn-primary"><Plus className="h-4 w-4" /> Crear recompensa</a>
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
              Puntos requeridos
              <input name="points_required" type="number" min="0" className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" placeholder="Ej. 200" />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Descripcion
              <textarea name="description" className="min-h-24 rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" placeholder="Condiciones del beneficio" />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-line bg-slate-50 p-3 text-sm font-bold">
              Activa al crear
              <ToggleRight className="h-6 w-6 text-brand-500" />
            </label>
            <button className="btn-primary">Guardar recompensa</button>
          </div>
        </form>

        <div className="grid gap-4 md:grid-cols-2">
          {rewards.map((reward) => (
            <div key={reward.name} className="rounded-lg border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <Gift className="h-5 w-5" />
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${reward.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {reward.active ? "Activa" : "Pausada"}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-black">{reward.name}</h3>
              <p className="mt-1 text-sm text-muted">{reward.type} · {reward.requirement}</p>
              <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm">
                <span className="flex items-center gap-2 text-muted"><Calendar className="h-4 w-4" /> Redenciones</span>
                <span className="font-black">{reward.redeemed}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
