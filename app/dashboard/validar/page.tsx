import { CheckCircle2, Coffee, Gift, ScanLine, ShieldCheck, Stamp, TicketPercent } from "lucide-react";
import { ClaimValidator } from "@/components/claim-validator";

const validations = [
  { code: "STAMP-ADD-9K2A1F", action: "Sumar sello", customer: "Juan Perez", detail: "Compra confirmada en Cafe Central", icon: Stamp },
  { code: "STAMP-REDEEM-P4M8QZ", action: "Redimir tarjeta", customer: "Juan Perez", detail: "Cafe gratis con 10 sellos", icon: Coffee },
  { code: "DISCOUNT-REDEEM-71XK2B", action: "15% descuento", customer: "Maria Gonzalez", detail: "Beneficio disponible en proxima visita", icon: TicketPercent },
  { code: "POINTS-BOOST-22LA9C", action: "Puntos dobles", customer: "Carlos Ruiz", detail: "Campaña activa de 3 p.m. a 5 p.m.", icon: Gift }
];

export default function ValidarQrPage() {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Validar QR</h1>
          <p className="mt-1 text-muted">Escanea solicitudes de clientes para sumar sellos o redimir beneficios</p>
        </div>
        <a href="#scanner" className="btn-primary"><ScanLine className="h-4 w-4" /> Abrir camara</a>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div id="scanner">
          <ClaimValidator />
          <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
            <div className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-700" />
              <p className="text-sm leading-6 text-emerald-800">El comercio es quien valida. El cliente no puede modificar sellos o redenciones por su cuenta.</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-5">
          <h2 className="font-black">Solicitudes recientes</h2>
          <div className="mt-4 grid gap-3">
            {validations.map((validation) => (
              <div key={validation.code} className="rounded-lg border border-line p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-brand-50 text-brand-600">
                    <validation.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black">{validation.action}</p>
                        <p className="text-sm text-muted">{validation.customer}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        Valida
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted">{validation.detail}</p>
                    <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                      <span className="font-bold text-muted">{validation.code}</span>
                      <span className="inline-flex items-center gap-1 font-black text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Aplicar
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
