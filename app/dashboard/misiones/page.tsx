import { Clock, CreditCard, MessageCircle, Pencil, Plus, Target, Trash2, Users } from "lucide-react";
import { createMission, deleteMission, updateMission } from "@/lib/actions/loyalty";
import { getDashboardMissions } from "@/lib/data/dashboard";

const templates = [
  { title: "Frecuencia de visita", detail: "Compra 2 veces esta semana", icon: Target, category: "frequency" },
  { title: "Referidos", detail: "Invita a un amigo nuevo", icon: Users, category: "referral" },
  { title: "Horario valle", detail: "Compra en horas de baja demanda", icon: Clock, category: "offpeak" },
  { title: "Pago con MiniPay", detail: "Incentiva pagos digitales", icon: CreditCard, category: "minipay" },
  { title: "Reseña verificada", detail: "Pide opinion despues de comprar", icon: MessageCircle, category: "review" }
];

const segments = [
  { value: "inactive", label: "Inactivo" },
  { value: "at_risk", label: "En riesgo" },
  { value: "active", label: "Activo" },
  { value: "vip", label: "VIP" }
];

export default async function MisionesPage() {
  const missions = await getDashboardMissions();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Misiones</h1>
          <p className="mt-1 text-muted">Acciones simples que empujan recurrencia, referidos y pagos</p>
        </div>
        <a href="#nueva-mision" className="btn-primary"><Plus className="h-4 w-4" /> Crear misión</a>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {templates.map((template) => (
          <div key={template.title} className="rounded-lg border border-line bg-white p-4 text-left">
            <template.icon className="h-5 w-5 text-brand-500" />
            <p className="mt-3 font-black">{template.title}</p>
            <p className="mt-1 text-sm text-muted">{template.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[390px_1fr]">
        <form id="nueva-mision" action={createMission} className="rounded-lg border border-line bg-white p-5">
          <h2 className="font-black">Nueva mision</h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-1 text-sm font-bold">
              Nombre
              <input name="name" className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" placeholder="Ej. Compra 2 veces" />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Categoria
              <select name="category" className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500">
                {templates.map((template) => (
                  <option key={template.category} value={template.category}>{template.title}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Meta
              <input name="goal" type="number" min="1" defaultValue="1" className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Tipo de usuario
              <select name="audience_segment" defaultValue="active" className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500">
                {segments.map((segment) => (
                  <option key={segment.value} value={segment.value}>{segment.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Duracion
              <select name="duration_type" defaultValue="indefinite" className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500">
                <option value="indefinite">Tiempo indefinido</option>
                <option value="one_hour">Una hora</option>
                <option value="custom">Fecha personalizada</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm font-bold">
                Desde
                <input name="starts_at" type="datetime-local" className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" />
              </label>
              <label className="grid gap-1 text-sm font-bold">
                Hasta
                <input name="ends_at" type="datetime-local" className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" />
              </label>
            </div>
            <label className="grid gap-1 text-sm font-bold">
              Puntos de recompensa
              <input name="reward_points" type="number" min="0" defaultValue="30" className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Descripcion
              <textarea name="description" className="min-h-24 rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" placeholder="Explica que debe hacer el cliente" />
            </label>
            <button className="btn-primary">Guardar mision</button>
          </div>
        </form>

        <div className="grid gap-4 md:grid-cols-2">
          {missions.map((mission) => (
            <div key={mission.id} className="rounded-lg border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-brand-600">{mission.category}</p>
                  <h2 className="mt-1 font-black">{mission.name}</h2>
                  <p className="mt-1 text-sm text-muted">{mission.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${mission.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {mission.active ? "Activa" : "Pausada"}
                  </span>
                  <form action={deleteMission}>
                    <input type="hidden" name="id" value={mission.id} />
                    <button className="grid h-9 w-9 place-items-center rounded-lg border border-line text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600" aria-label={`Eliminar ${mission.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-muted">Usuario</p>
                  <p className="mt-1 font-black">{mission.audience}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-muted">Duracion</p>
                  <p className="mt-1 font-black">{mission.schedule}</p>
                </div>
              </div>
              <div className="mt-5 h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${mission.progress}%` }} />
              </div>
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-muted">{mission.progress}% completado</span>
                <span className="font-black text-amber-700">{mission.reward}</span>
              </div>
              <details className="mt-4 border-t border-line pt-4">
                <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700">
                  <Pencil className="h-4 w-4" />
                  Editar
                </summary>
                <form action={updateMission} className="mt-4 grid gap-3">
                  <input type="hidden" name="id" value={mission.id} />
                  <input
                    name="name"
                    defaultValue={mission.name}
                    className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm"
                    aria-label="Nombre de mision"
                  />
                  <select name="category" defaultValue={mission.categoryValue} className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm">
                    {templates.map((template) => (
                      <option key={template.category} value={template.category}>{template.title}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      name="goal"
                      type="number"
                      min="1"
                      defaultValue={mission.goal}
                      className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm"
                      aria-label="Meta"
                    />
                    <input
                      name="reward_points"
                      type="number"
                      min="0"
                      defaultValue={mission.rewardPoints}
                      className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm"
                      aria-label="Puntos"
                    />
                  </div>
                  <select name="audience_segment" defaultValue={mission.audienceSegment} className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm">
                    {segments.map((segment) => (
                      <option key={segment.value} value={segment.value}>{segment.label}</option>
                    ))}
                  </select>
                  <select name="duration_type" defaultValue={mission.durationType} className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm">
                    <option value="indefinite">Tiempo indefinido</option>
                    <option value="one_hour">Una hora</option>
                    <option value="custom">Fecha personalizada</option>
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <input name="starts_at" type="datetime-local" defaultValue={mission.startsAtInput} className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" aria-label="Fecha inicial" />
                    <input name="ends_at" type="datetime-local" defaultValue={mission.endsAtInput} className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm" aria-label="Fecha final" />
                  </div>
                  <textarea
                    name="description"
                    defaultValue={mission.description}
                    className="min-h-20 rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm"
                    aria-label="Descripcion de mision"
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
