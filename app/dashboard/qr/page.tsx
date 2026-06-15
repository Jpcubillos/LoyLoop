import Link from "next/link";
import { Copy, Download, Printer, QrCode, Smartphone } from "lucide-react";

export default function QrPage() {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">QR del comercio</h1>
          <p className="mt-1 text-muted">Punto de entrada para que cada cliente se una al club</p>
        </div>
        <Link href="/c/cafe-central" className="btn-primary"><Smartphone className="h-4 w-4" /> Abrir demo cliente</Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="rounded-lg border border-line bg-white p-6">
          <div className="grid aspect-square place-items-center rounded-lg border border-line bg-brand-50">
            <QrCode className="h-48 w-48 text-brand-700" />
          </div>
          <p className="mt-5 text-center text-lg font-black">Café Central</p>
          <p className="mt-1 text-center text-sm text-muted">loyloop.app/c/cafe-central</p>
          <div className="mt-5 grid gap-2">
            <button className="btn-primary"><Download className="h-4 w-4" /> Descargar QR</button>
            <button className="btn-secondary"><Printer className="h-4 w-4" /> Imprimir cartel</button>
            <button className="btn-secondary"><Copy className="h-4 w-4" /> Copiar enlace</button>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-5">
          <h2 className="font-black">Cartel para mostrador</h2>
          <div className="mt-5 grid min-h-[520px] place-items-center rounded-lg bg-brand-500 p-8 text-center text-white">
            <div className="max-w-sm">
              <div className="mx-auto grid h-32 w-32 place-items-center rounded-lg bg-white text-brand-600">
                <QrCode className="h-24 w-24" />
              </div>
              <h3 className="mt-7 text-4xl font-black">Escanea y gana</h3>
              <p className="mt-3 text-white/80">Únete al club de Café Central, recibe crédito de bienvenida y completa misiones.</p>
              <div className="mx-auto mt-6 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-brand-700">
                Powered by LoyLoop
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
