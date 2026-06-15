import { Megaphone, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { createCampaign, deleteCampaign, updateCampaign } from "@/lib/actions/loyalty";
import { getDashboardCampaigns } from "@/lib/data/dashboard";

const segments = [
  { value: "inactive", label: "Inactivo" },
  { value: "at_risk", label: "En riesgo" },
  { value: "active", label: "Activo" },
  { value: "vip", label: "VIP" }
];

export default async function CampanasPage() {
  const campaigns = await getDashboardCampaigns();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Campanas</h1>
          <p className="mt-1 text-muted">Promociones para mover clientes en momentos clave</p>
        </div>
        <a href="#crear-campana" className="btn-primary">
          <Plus className="h-4 w-4" /> Nueva campana
        </a>
      </div>

      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <div id="crear-campana" className="rounded-lg border border-line bg-white p-5">
          <h2 className="font-black">Campana rapida</h2>
          <form action={createCampaign} className="mt-5 grid gap-4">
            <input
              name="name"
              className="rounded-lg border border-line bg-slate-50 px-3 py-2"
              placeholder="Nombre de campana"
              required
            />
            <select name="type" className="rounded-lg border border-line bg-slate-50 px-3 py-2">
              <option value="discount_redeem">Descuento redimible</option>
              <option value="points_boost">Puntos extra</option>
            </select>
            <select name="audience_segment" defaultValue="active" className="rounded-lg border border-line bg-slate-50 px-3 py-2">
              {segments.map((segment) => (
                <option key={segment.value} value={segment.value}>{segment.label}</option>
              ))}
            </select>
            <select name="duration_type" defaultValue="indefinite" className="rounded-lg border border-line bg-slate-50 px-3 py-2">
              <option value="indefinite">Tiempo indefinido</option>
              <option value="one_hour">Una hora</option>
              <option value="custom">Fecha personalizada</option>
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input
                name="starts_at"
                type="datetime-local"
                className="rounded-lg border border-line bg-slate-50 px-3 py-2"
                aria-label="Fecha inicial"
              />
              <input
                name="ends_at"
                type="datetime-local"
                className="rounded-lg border border-line bg-slate-50 px-3 py-2"
                aria-label="Fecha final"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                name="discount_percent"
                type="number"
                min="1"
                max="100"
                className="rounded-lg border border-line bg-slate-50 px-3 py-2"
                placeholder="% dto."
              />
              <input
                name="reward_points"
                type="number"
                min="0"
                className="rounded-lg border border-line bg-slate-50 px-3 py-2"
                placeholder="Puntos"
              />
            </div>
            <textarea
              name="description"
              className="min-h-28 rounded-lg border border-line bg-slate-50 px-3 py-2"
              placeholder="Mensaje corto para la campana"
            />
            <button className="btn-primary">
              <Send className="h-4 w-4" /> Publicar campana
            </button>
          </form>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="rounded-lg border border-line bg-white p-5">
              <Megaphone className="h-5 w-5 text-brand-500" />
              <div className="mt-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-black">{campaign.name}</h2>
                  <p className="mt-1 text-xs font-bold uppercase text-muted">{campaign.type}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${campaign.tone === "green" ? "bg-emerald-50 text-emerald-700" : campaign.tone === "blue" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-600"}`}>
                    {campaign.status}
                  </span>
                  <form action={deleteCampaign}>
                    <input type="hidden" name="id" value={campaign.id} />
                    <button className="grid h-9 w-9 place-items-center rounded-lg border border-line text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600" aria-label={`Eliminar ${campaign.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{campaign.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-muted">Usuario</p>
                  <p className="mt-1 text-sm font-black">{campaign.audience}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-muted">Duracion</p>
                  <p className="mt-1 text-sm font-black">{campaign.schedule}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-muted">Alcance</p>
                  <p className="mt-1 text-xl font-black">{campaign.reach}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-muted">Redenciones</p>
                  <p className="mt-1 text-xl font-black">{campaign.redemptions}</p>
                </div>
              </div>
              <details className="mt-4 border-t border-line pt-4">
                <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700">
                  <Pencil className="h-4 w-4" />
                  Editar
                </summary>
                <form action={updateCampaign} className="mt-4 grid gap-3">
                  <input type="hidden" name="id" value={campaign.id} />
                  <input
                    name="name"
                    defaultValue={campaign.name}
                    className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm"
                    aria-label="Nombre de campana"
                  />
                  <select name="type" defaultValue={campaign.typeValue} className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm">
                    <option value="discount_redeem">Descuento redimible</option>
                    <option value="points_boost">Puntos extra</option>
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      name="discount_percent"
                      type="number"
                      min="1"
                      max="100"
                      defaultValue={campaign.discountPercent || ""}
                      className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm"
                      placeholder="% dto."
                    />
                    <input
                      name="reward_points"
                      type="number"
                      min="0"
                      defaultValue={campaign.rewardPoints}
                      className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm"
                      placeholder="Puntos"
                    />
                  </div>
                  <select name="audience_segment" defaultValue={campaign.audienceSegment} className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm">
                    {segments.map((segment) => (
                      <option key={segment.value} value={segment.value}>{segment.label}</option>
                    ))}
                  </select>
                  <select name="duration_type" defaultValue={campaign.durationType} className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm">
                    <option value="indefinite">Tiempo indefinido</option>
                    <option value="one_hour">Una hora</option>
                    <option value="custom">Fecha personalizada</option>
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <input name="starts_at" type="datetime-local" defaultValue={campaign.startsAtInput} className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" aria-label="Fecha inicial" />
                    <input name="ends_at" type="datetime-local" defaultValue={campaign.endsAtInput} className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" aria-label="Fecha final" />
                  </div>
                  <textarea
                    name="description"
                    defaultValue={campaign.description}
                    className="min-h-20 rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm"
                    aria-label="Descripcion de campana"
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
