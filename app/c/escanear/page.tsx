import Link from "next/link";
import { Camera, CheckCircle2, QrCode, ShieldCheck, Store } from "lucide-react";
import { CustomerBottomNav } from "@/components/customer-bottom-nav";
import { joinBusinessAction } from "@/lib/actions/loyalty";

export default function EscanearPage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 shadow-soft">
        <header className="bg-brand-500 px-5 pb-6 pt-8 text-white">
          <h1 className="text-2xl font-black">Escanear QR</h1>
          <p className="mt-1 text-sm text-blue-100">Unete a un comercio o registra una compra</p>
        </header>
        <section className="flex flex-1 flex-col gap-4 p-4 pb-24">
          <div className="grid aspect-square place-items-center rounded-lg border-2 border-dashed border-brand-200 bg-white p-6">
            <div className="text-center">
              <div className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-brand-50 text-brand-600">
                <Camera className="h-12 w-12" />
              </div>
              <p className="mt-5 font-black">Camara lista para escanear</p>
              <p className="mt-2 text-sm text-muted">Apunta al QR que el comercio tiene en caja.</p>
            </div>
          </div>
          <form action={joinBusinessAction}>
            <button className="btn-primary h-12 w-full">
              <QrCode className="h-4 w-4" />
              Simular QR de Cafe Central
            </button>
          </form>
          <div className="grid gap-3">
            {[
              ["Te unes al comercio", Store],
              ["Recibes beneficio inicial", CheckCircle2],
              ["Tus puntos quedan separados por negocio", ShieldCheck]
            ].map(([text, Icon]) => (
              <div key={text as string} className="flex items-center gap-3 rounded-lg border border-line bg-white p-4 text-sm font-bold">
                <Icon className="h-5 w-5 text-brand-500" />
                {text as string}
              </div>
            ))}
          </div>
        </section>
        <CustomerBottomNav active="Escanear" />
      </div>
    </main>
  );
}
