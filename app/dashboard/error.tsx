"use client";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
      <h2 className="font-bold">No pudimos cargar la información del panel.</h2>
      <p className="mt-2 text-sm">Revisa tu conexión con Supabase e inténtalo de nuevo.</p>
      {error.digest && <p className="mt-2 text-xs text-rose-700">Referencia: {error.digest}</p>}
      <button type="button" onClick={reset} className="btn-primary mt-4">Reintentar</button>
    </div>
  );
}
