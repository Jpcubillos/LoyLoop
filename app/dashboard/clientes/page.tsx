import { Download, Filter, MessageCircle, Plus, Search, Users } from "lucide-react";
import { customers } from "@/lib/dashboard-data";

export default function ClientesPage() {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Clientes</h1>
          <p className="mt-1 text-muted">Personas que se unieron al club de Café Central</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary"><Download className="h-4 w-4" /> Exportar</button>
          <button className="btn-primary"><Plus className="h-4 w-4" /> Agregar cliente</button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
          <Search className="h-4 w-4 text-muted" />
          <span className="text-sm text-muted">Buscar por nombre, teléfono o estado</span>
        </div>
        <button className="btn-secondary"><Filter className="h-4 w-4" /> Filtros</button>
        <button className="btn-secondary"><MessageCircle className="h-4 w-4" /> Enviar campaña</button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {["Clientes VIP: 86", "Con MiniPay: 312", "En riesgo: 47"].map((item) => (
          <div key={item} className="rounded-lg border border-line bg-white p-4">
            <Users className="h-5 w-5 text-brand-500" />
            <p className="mt-3 text-xl font-black">{item}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="border-b border-line bg-slate-50 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Visitas</th>
              <th className="px-4 py-3">Puntos</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Gastado</th>
              <th className="px-4 py-3 text-right">Última visita</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {customers.map((customer) => (
              <tr key={customer.name}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-xs font-black text-brand-700">{customer.initials}</span>
                    <span className="font-black">{customer.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">{customer.visits}</td>
                <td className="px-4 py-3 font-black text-brand-700">{customer.points}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{customer.status}</span></td>
                <td className="px-4 py-3">{customer.spent}</td>
                <td className="px-4 py-3 text-right text-muted">{customer.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
