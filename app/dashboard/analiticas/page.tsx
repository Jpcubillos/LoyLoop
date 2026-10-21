import { chart, customers } from "@/lib/dashboard-data";

export default function AnaliticasPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-black">Analíticas</h1>
        <p className="mt-1 text-muted">Entiende qué beneficios hacen volver a tus clientes</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["42%", "Tasa de regreso"],
          ["$18.400", "Ticket promedio"],
          ["6,4", "Visitas por cliente"],
          ["31", "Referidos este mes"]
        ].map(([value, label]) => (
          <div key={label} className="admin-stat rounded-lg border border-line bg-white p-5">
            <p className="text-3xl font-black">{value}</p>
            <p className="mt-1 text-sm text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_390px]">
        <div className="rounded-lg border border-line bg-white p-5">
          <h2 className="font-black">Visitas y redenciones</h2>
          <div className="mt-6 flex h-72 items-end gap-3">
            {chart.map((value, index) => (
              <div key={index} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end rounded bg-brand-50">
                  <div className="admin-chart-bar w-full rounded-t-lg" style={{ height: `${value}%` }} />
                </div>
                <span className="text-xs text-muted">{["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][index]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-5">
          <h2 className="font-black">Top clientes</h2>
          <div className="mt-4 space-y-3">
            {customers.slice(0, 5).map((customer) => (
              <div key={customer.name} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-xs font-black text-brand-700">{customer.initials}</span>
                  <div>
                    <p className="text-sm font-black">{customer.name}</p>
                    <p className="text-xs text-muted">{customer.visits} visitas</p>
                  </div>
                </div>
                <span className="font-black">{customer.points}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
