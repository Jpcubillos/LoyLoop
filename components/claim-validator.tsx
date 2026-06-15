"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, QrCode, XCircle } from "lucide-react";

export function ClaimValidator() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<any>(null);

  async function validate(nextCode = code) {
    const cleanCode = nextCode.trim();
    if (!cleanCode) return;

    setLoading(true);
    setMessage("");
    setOk(null);

    const response = await fetch("/api/claim-requests/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: cleanCode,
        businessSlug: "cafe-central"
      })
    });

    const result = await response.json();
    setLoading(false);
    setOk(Boolean(result.ok));
    setMessage(result.message ?? "Validacion procesada.");
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
            await validate(decodedText);
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
      <h2 className="font-black">Escaner del comercio</h2>
      <div className="mt-5 grid aspect-square place-items-center rounded-lg border-2 border-dashed border-brand-200 bg-brand-50 p-4">
        {scanning ? (
          <div id="claim-qr-reader" className="w-full overflow-hidden rounded-lg bg-white" />
        ) : (
          <div className="text-center">
            <QrCode className="mx-auto h-28 w-28 text-brand-700" />
            <p className="mt-4 font-black">Apunta al QR del cliente</p>
            <p className="mt-2 max-w-xs text-sm leading-6 text-muted">
              Tambien puedes pegar el codigo manualmente.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-2">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm font-bold tracking-wide outline-none focus:border-brand-500"
          placeholder="STAMP-ADD-ABC123"
        />
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={() => setScanning((value) => !value)}>
            <Camera className="h-4 w-4" />
            {scanning ? "Cerrar" : "Camara"}
          </button>
          <button className="btn-primary" onClick={() => validate()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Validar
          </button>
        </div>
      </div>

      {message && (
        <div className={`mt-4 rounded-lg p-3 ${ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          <div className="flex gap-2">
            {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <XCircle className="mt-0.5 h-4 w-4" />}
            <p className="text-sm font-bold leading-6">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
