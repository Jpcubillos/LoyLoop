"use client";

import { useState } from "react";
import { ChevronDown, Coffee, Stamp } from "lucide-react";
import { ClaimQr } from "@/components/claim-qr";

export function StampCard({
  currentStamps = 6,
  requiredStamps = 10,
  message
}: {
  currentStamps?: number;
  requiredStamps?: number;
  message?: string;
}) {
  const [open, setOpen] = useState(false);
  const total = requiredStamps;
  const current = currentStamps;

  return (
    <div className="overflow-hidden rounded-lg border border-amber-200 bg-white">
      <button
        className="flex w-full items-center gap-3 p-4 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-amber-50 text-amber-700">
          <Coffee className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black">Cafe gratis con 10 sellos</p>
          <p className="text-xs text-muted">Llevas {current} de {total} sellos</p>
          <div className="mt-2 h-1.5 rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${(current / total) * 100}%` }} />
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-amber-100 bg-amber-50/55 p-4">
          <div className="rounded-lg border border-amber-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-amber-700">Tarjeta de sellos</p>
                <p className="mt-1 font-black text-ink">Cafe Central</p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                {current}/{total}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {Array.from({ length: total }).map((_, index) => {
                const stamped = index < current;
                return (
                  <div
                    key={index}
                    className={`grid aspect-square place-items-center rounded-full border-2 ${
                      stamped
                        ? "border-amber-500 bg-amber-100 text-amber-700"
                        : "border-dashed border-slate-300 bg-slate-50 text-slate-300"
                    }`}
                  >
                    {stamped ? <Stamp className="h-5 w-5" /> : <span className="text-xs font-black">{index + 1}</span>}
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs leading-5 text-muted">
              Completa 10 compras registradas y reclama un cafe gratis en caja.
            </p>
            {message && (
              <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700">
                {message}
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <ClaimQr
                action="stamp_add"
                label="Sumar sello"
                description="Este QR debe ser escaneado por el comercio despues de confirmar tu compra."
                disabled={current >= total}
                disabledMessage="Ya llegaste al maximo de sellos."
                className="btn-secondary w-full text-xs disabled:cursor-not-allowed disabled:opacity-60"
              >
                {current >= total ? "Maximo" : "Sumar sello"}
              </ClaimQr>
              <ClaimQr
                action="stamp_redeem"
                label="Redimir cafe gratis"
                description="Este QR permite al comercio verificar que completaste la tarjeta antes de entregar el beneficio."
                disabled={current < total}
                disabledMessage="Completa los 10 sellos para redimir."
                className="btn-primary w-full text-xs disabled:cursor-not-allowed disabled:opacity-60"
              >
                Redimir
              </ClaimQr>
            </div>
            {current < total && (
              <p className="mt-2 text-center text-[11px] font-bold text-muted">
                Podras redimir cuando completes los {total} sellos.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
