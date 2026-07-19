import { UserRound } from "lucide-react";
import { CustomerBottomNav } from "@/components/customer-bottom-nav";
import { CustomerProfileActions } from "@/components/customer-profile-actions";

export default function PerfilClientePage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 shadow-soft">
        <header className="bg-white px-5 pb-5 pt-8">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-700">
              <UserRound className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black">Juan Perez</h1>
              <p className="text-sm text-muted">juan@loyloop.app</p>
            </div>
          </div>
        </header>
        <section className="flex flex-1 flex-col gap-4 p-4 pb-24">
          <div className="rounded-lg border border-line bg-white p-4">
            <p className="text-sm font-bold text-muted">Resumen</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              {[
                ["3", "comercios"],
                ["245", "puntos"],
                ["4", "premios"]
              ].map(([value, label]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xl font-black">{value}</p>
                  <p className="text-xs text-muted">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <CustomerProfileActions />
        </section>
        <CustomerBottomNav active="Perfil" />
      </div>
    </main>
  );
}
