"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ClipboardList, Store } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const db = supabase as any;

type Lead = {
  id: string;
  owner_name: string;
  business_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  category: string | null;
  message: string | null;
  status: string;
  business_id: string | null;
  created_at: string;
};

export default function SolicitudesPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    const { data: approver, error: accessError } = await db
      .from("platform_business_approvers")
      .select("user_id")
      .limit(1);
    if (accessError || !approver?.length) {
      setLoading(false);
      setMessage("Tu cuenta aún no tiene autorización para revisar solicitudes de comercios.");
      return;
    }
    const { data, error } = await db
      .from("business_leads")
      .select("id, owner_name, business_name, email, phone, city, category, message, status, business_id, created_at")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) setMessage(error.message);
    else setLeads(data ?? []);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function approve(lead: Lead) {
    setApproving(lead.id);
    setMessage("");
    const { error } = await db.rpc("approve_business_lead", { p_lead_id: lead.id });
    setApproving(null);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`${lead.business_name} ya aparece en el catálogo de la app móvil.`);
    await reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600"><ClipboardList className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-black">Solicitudes de comercios</h1>
          <p className="text-sm text-muted">Revisa cada registro antes de publicarlo en LoyLoop.</p>
        </div>
      </div>
      {message && <p role="status" className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">{message}</p>}
      {loading ? <p className="text-sm text-muted">Cargando solicitudes…</p> : leads.length === 0 ? (
        <div className="rounded-[22px] border border-line bg-white p-8 text-center text-muted">Aún no hay solicitudes de comercios.</div>
      ) : (
        <div className="grid gap-4">
          {leads.map((lead) => (
            <article key={lead.id} className="rounded-[22px] border border-line bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="flex items-center gap-2 text-lg font-bold"><Store className="h-5 w-5 text-brand-600" />{lead.business_name}</h2>
                  <p className="text-sm text-muted">{lead.category || "Sin categoría"}{lead.city ? ` · ${lead.city}` : ""}</p>
                  <p className="text-sm">{lead.owner_name} · {lead.email}{lead.phone ? ` · ${lead.phone}` : ""}</p>
                  {lead.message && <p className="max-w-2xl text-sm text-muted">{lead.message}</p>}
                </div>
                {lead.business_id ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-xs font-semibold text-green-700"><Check className="h-4 w-4" />Publicado</span>
                ) : lead.status === "rejected" ? (
                  <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-muted">Rechazado</span>
                ) : (
                  <button className="btn-primary" disabled={approving === lead.id} onClick={() => void approve(lead)}>
                    {approving === lead.id ? "Publicando…" : "Aprobar y publicar"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
