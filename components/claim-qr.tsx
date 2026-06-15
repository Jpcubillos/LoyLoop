"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Copy, QrCode, X } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

type ClaimQrProps = {
  action: "stamp_add" | "stamp_redeem" | "discount_redeem" | "points_boost";
  businessName?: string;
  label: string;
  description: string;
  disabled?: boolean;
  disabledMessage?: string;
  payload?: Record<string, unknown>;
  children: React.ReactNode;
  className?: string;
};

const actionLabels = {
  stamp_add: "Sumar sello",
  stamp_redeem: "Redimir tarjeta",
  discount_redeem: "Redimir descuento",
  points_boost: "Activar puntos dobles"
};

export function ClaimQr({
  action,
  businessName = "Cafe Central",
  label,
  description,
  disabled,
  disabledMessage,
  payload = {},
  children,
  className
}: ClaimQrProps) {
  const [open, setOpen] = useState(false);
  const [claimCode, setClaimCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const qrValue = useMemo(() => claimCode, [claimCode]);

  async function openClaim() {
    setOpen(true);
    setError("");
    setLoading(true);

    const response = await fetch("/api/claim-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actionType: action,
        businessSlug: "cafe-central",
        payload: { ...payload, label, description }
      })
    });

    const result = await response.json();
    setLoading(false);

    if (!response.ok || !result.ok) {
      setError(result.message ?? "No se pudo generar el QR.");
      return;
    }

    setClaimCode(result.code);
    setExpiresAt(result.expiresAt);
  }

  if (disabled) {
    return (
      <button type="button" className={className} disabled title={disabledMessage}>
        {children}
      </button>
    );
  }

  return (
    <>
      <button type="button" className={className} onClick={openClaim}>
        {children}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-brand-600">{businessName}</p>
                <h3 className="mt-1 text-xl font-black text-ink">{label}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
              </div>
              <button
                className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-muted"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 rounded-lg border border-line bg-brand-50 p-5">
              <div className="grid aspect-square place-items-center rounded-lg bg-white p-4 text-brand-700">
                {loading ? (
                  <div className="text-center">
                    <QrCode className="mx-auto h-16 w-16 animate-pulse" />
                    <p className="mt-3 text-sm font-bold text-muted">Generando QR...</p>
                  </div>
                ) : error ? (
                  <p className="text-center text-sm font-bold text-red-600">{error}</p>
                ) : (
                  <QRCodeCanvas value={qrValue} size={190} level="M" includeMargin />
                )}
              </div>
              <div className="mt-4 rounded-lg bg-white p-3 text-center">
                <p className="text-xs font-bold uppercase text-muted">Codigo de validacion</p>
                <p className="mt-1 font-black tracking-wide text-ink">{claimCode || "..."}</p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <p className="text-sm leading-6 text-emerald-800">
                  Muestrale este QR al comercio. Al escanearlo desde su panel se valida la accion y se actualizan tus beneficios.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="btn-secondary text-xs" onClick={() => navigator.clipboard?.writeText(claimCode)} disabled={!claimCode}>
                <Copy className="h-4 w-4" />
                Copiar
              </button>
              <button className="btn-primary text-xs" onClick={() => setOpen(false)}>
                Listo
              </button>
            </div>

            <p className="mt-3 text-center text-[11px] font-bold text-muted">
              Tipo: {actionLabels[action]} · {expiresAt ? "Expira en 5 minutos" : "Esperando QR"}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
