"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Clock, Loader2, QrCode, ShieldAlert, Sparkles, User, X, XCircle } from "lucide-react";

type PreviewData = {
  claimId: string;
  code: string;
  customerName: string;
  customerId: string;
  actionType: string;
  benefitTitle: string;
  detail: string;
  expiresAt: string;
  status: string;
  canConfirm: boolean;
};

export function ClaimValidator() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const scannerRef = useRef<any>(null);

  // Paso 1: Inspeccionar / Previsualizar el código sin consumirlo
  async function inspectCode(targetCode = code) {
    const cleanCode = targetCode.trim();
    if (!cleanCode) return;

    setLoading(true);
    setMessage("");
    setOk(null);
    setPreview(null);

    try {
      const response = await fetch("/api/claim-requests/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode })
      });

      const result = await response.json().catch(() => ({
        ok: false,
        message: "El servidor respondio con un formato inesperado."
      }));

      if (!response.ok || !result.ok) {
        setOk(false);
        setMessage(result.message ?? "No se pudo validar el código.");
        return;
      }

      setPreview(result as PreviewData);
      setCode(cleanCode);
    } catch (error) {
      setOk(false);
      setMessage(error instanceof Error ? error.message : "Error de conexión al consultar el código.");
    } finally {
      setLoading(false);
    }
  }

  // Paso 2: Confirmación explícita atómica del comercio
  async function confirmOperation() {
    if (!preview) return;

    setConfirming(true);
    setMessage("");

    try {
      const response = await fetch("/api/claim-requests/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: preview.code,
          businessSlug: "cafe-central"
        })
      });

      const result = await response.json().catch(() => ({
        ok: false,
        message: "El servidor respondio con un formato inesperado."
      }));

      if (!response.ok || !result.ok) {
        setOk(false);
        setMessage(result.message ?? "No se pudo confirmar la operación.");
        return;
      }

      setOk(true);
      setMessage(result.message ?? "Operación confirmada y beneficio otorgado con éxito.");
      setPreview(null);
      setCode("");
    } catch (error) {
      setOk(false);
      setMessage(error instanceof Error ? error.message : "No se pudo conectar con el servidor para confirmar.");
    } finally {
      setConfirming(false);
    }
  }

  function cancelPreview() {
    setPreview(null);
    setMessage("");
    setOk(null);
  }

  useEffect(() => {
    let cancelled = false;

    async function startScanner() {
      if (!scanning) return;

      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;

      const scanner = new Html5Qrcode("claim-qr-reader");
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decodedText: string) => {
            setCode(decodedText);
            setScanning(false);
            await scanner.stop();
            await inspectCode(decodedText);
          },
          () => {}
        );
      } catch (error) {
        setScanning(false);
        setOk(false);
        setMessage(error instanceof Error ? error.message : "No se pudo abrir la camara.");
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [scanning]);

  return (
    <div className="rounded-lg border border-line bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-black">Escáner del comercio</h2>
        {preview && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
            <Clock className="h-3 w-3" /> Pendiente de confirmación
          </span>
        )}
      </div>

      {!preview && (
        <div className="mt-5 grid aspect-square place-items-center rounded-lg border-2 border-dashed border-brand-200 bg-brand-50 p-4">
          {scanning ? (
            <div id="claim-qr-reader" className="w-full overflow-hidden rounded-lg bg-white" />
          ) : (
            <div className="text-center">
              <QrCode className="mx-auto h-28 w-28 text-brand-700" />
              <p className="mt-4 font-black">Apunta al QR del cliente</p>
              <p className="mt-2 max-w-xs text-sm leading-6 text-muted">
                También puedes pegar el código QR o el código manual de 16 dígitos.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Vista previa de confirmación explícita (LL-22) */}
      {preview && (
        <div className="mt-5 rounded-lg border-2 border-brand-500 bg-brand-50/50 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 text-brand-700 font-bold">
                <User className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase text-muted">Cliente verificado</p>
                <p className="font-black text-lg text-ink">{preview.customerName}</p>
              </div>
            </div>
            <button
              onClick={cancelPreview}
              className="text-slate-400 hover:text-slate-600 p-1"
              title="Cancelar previsualización"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 space-y-2 rounded-lg bg-white p-4 border border-line">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted uppercase">Operación</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                <Sparkles className="h-3.5 w-3.5" /> {preview.benefitTitle}
              </span>
            </div>
            <p className="text-sm font-semibold text-ink">{preview.detail}</p>
            <div className="border-t border-line pt-2 text-xs text-muted flex justify-between">
              <span>Código: <strong className="font-mono text-ink">{preview.code}</strong></span>
              <span>Expira: <strong>{new Date(preview.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              className="btn-secondary"
              onClick={cancelPreview}
              disabled={confirming}
            >
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={confirmOperation}
              disabled={confirming}
            >
              {confirming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Confirmando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Confirmar canje
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Controles de entrada de código */}
      {!preview && (
        <div className="mt-4 grid gap-2">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") void inspectCode();
            }}
            className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm font-bold tracking-wide outline-none focus:border-brand-500"
            placeholder="Pega el QR o código manual (ej. 16 dígitos)"
            aria-label="Código de validación del cliente"
          />
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary" onClick={() => setScanning((value) => !value)}>
              <Camera className="h-4 w-4" />
              {scanning ? "Cerrar cámara" : "Cámara"}
            </button>
            <button className="btn-primary" onClick={() => inspectCode()} disabled={loading || !code.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Inspeccionar
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className={`mt-4 rounded-lg p-3 ${ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          <div className="flex gap-2">
            {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <div>
              <p className="text-sm font-bold leading-6">{message}</p>
              {ok && (
                <button
                  onClick={() => {
                    setMessage("");
                    setOk(null);
                  }}
                  className="mt-2 text-xs font-bold underline text-emerald-900"
                >
                  Escanear siguiente cliente
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
