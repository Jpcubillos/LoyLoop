"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Store, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const db = supabase as any;

type AuthMode = "client" | "team" | "business";

const clientDemoUsers = [
  { email: "cliente.inactivo@loyloop.app", label: "Inactivo", detail: "Campanas de reactivacion" },
  { email: "cliente.riesgo@loyloop.app", label: "En riesgo", detail: "Baja frecuencia" },
  { email: "cliente.activo@loyloop.app", label: "Activo", detail: "Cliente frecuente" },
  { email: "cliente.vip@loyloop.app", label: "VIP", detail: "Alto valor" }
];

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("client");
  const [clientAuthMode, setClientAuthMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("cliente.activo@loyloop.app");
  const [password, setPassword] = useState("LoyLoopDemo2026!");
  const [ownerName, setOwnerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [leadMessage, setLeadMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitAuth() {
    setLoading(true);
    setFeedback("");

    const result = clientAuthMode === "login" || mode === "team"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (result.error) {
      setFeedback(result.error.message);
      return;
    }

    setFeedback(clientAuthMode === "signup" && mode === "client" ? "Cuenta creada. Revisa tu correo si Supabase pide confirmacion." : "Sesion iniciada.");
    router.push(mode === "team" ? "/dashboard" : "/c");
    router.refresh();
  }

  async function submitBusinessLead() {
    setLoading(true);
    setFeedback("");

    const { error } = await db.from("business_leads").insert({
      owner_name: ownerName,
      business_name: businessName,
      email,
      phone,
      city,
      category,
      message: leadMessage
    });

    setLoading(false);

    if (error) {
      setFeedback(error.message);
      return;
    }

    setOwnerName("");
    setBusinessName("");
    setPhone("");
    setCity("");
    setCategory("");
    setLeadMessage("");
    setFeedback("Solicitud enviada. Te contactaremos para activar el comercio.");
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-soft">
      <div className="mb-6">
        <p className="text-sm font-bold text-brand-600">LoyLoop</p>
        <h1 className="mt-2 text-3xl font-black text-ink">
          {mode === "client" ? "Entrar como cliente" : mode === "team" ? "Acceso del comercio" : "Registrar comercio"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          {mode === "client"
            ? "Crea tu cuenta o inicia sesion para ver tus beneficios."
            : mode === "team"
              ? "Solo para duenios, administradores y cajeros creados por el comercio."
              : "Dejanos tus datos y te contactamos para activar tu negocio."}
        </p>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2">
        {[
          { value: "client", label: "Cliente", icon: UserRound },
          { value: "team", label: "Equipo", icon: Store },
          { value: "business", label: "Comercio", icon: Building2 }
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            className={`grid place-items-center gap-1 rounded-lg border px-2 py-3 text-xs font-black ${mode === item.value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line bg-slate-50 text-muted"}`}
            onClick={() => {
              setMode(item.value as AuthMode);
              setFeedback("");
              if (item.value === "team") {
                setEmail("owner@loyloop.app");
                setPassword("LoyLoopDemo2026!");
                setClientAuthMode("login");
              }
              if (item.value === "client") {
                setEmail("cliente.activo@loyloop.app");
                setPassword("LoyLoopDemo2026!");
              }
            }}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      {mode === "client" && (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
            <button type="button" className={`rounded-md py-2 text-sm font-black ${clientAuthMode === "signup" ? "bg-white text-brand-700 shadow-sm" : "text-muted"}`} onClick={() => setClientAuthMode("signup")}>
              Crear cuenta
            </button>
            <button type="button" className={`rounded-md py-2 text-sm font-black ${clientAuthMode === "login" ? "bg-white text-brand-700 shadow-sm" : "text-muted"}`} onClick={() => setClientAuthMode("login")}>
              Entrar
            </button>
          </div>
          <div className="grid gap-2">
            <p className="text-xs font-bold uppercase text-muted">Clientes demo</p>
            <div className="grid grid-cols-2 gap-2">
              {clientDemoUsers.map((user) => (
                <button
                  key={user.email}
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-left text-xs ${email === user.email ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line bg-slate-50 text-muted"}`}
                  onClick={() => {
                    setEmail(user.email);
                    setPassword("LoyLoopDemo2026!");
                    setClientAuthMode("login");
                  }}
                >
                  <span className="block font-black">{user.label}</span>
                  <span className="mt-1 block leading-4">{user.detail}</span>
                </button>
              ))}
            </div>
          </div>
          <AuthFields email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
          {feedback && <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted">{feedback}</p>}
          <button className="btn-primary h-11" onClick={submitAuth} disabled={loading}>
            {loading ? "Procesando..." : clientAuthMode === "signup" ? "Crear cuenta cliente" : "Entrar"}
          </button>
        </div>
      )}

      {mode === "team" && (
        <div className="grid gap-4">
          <AuthFields email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
          <p className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-800">
            Los administradores y cajeros se crean desde Configuracion por el duenio del comercio.
          </p>
          {feedback && <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted">{feedback}</p>}
          <button className="btn-primary h-11" onClick={submitAuth} disabled={loading}>
            {loading ? "Procesando..." : "Entrar al panel"}
          </button>
        </div>
      )}

      {mode === "business" && (
        <div className="grid gap-4">
          <label className="grid gap-1 text-sm font-bold">
            Nombre del duenio
            <input className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Nombre del comercio
            <input className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Correo
            <input className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm font-bold">
              Telefono
              <input className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Ciudad
              <input className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" value={city} onChange={(event) => setCity(event.target.value)} />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-bold">
            Categoria
            <input className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Cafeteria, barberia, gimnasio..." />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Mensaje
            <textarea className="min-h-24 rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500" value={leadMessage} onChange={(event) => setLeadMessage(event.target.value)} placeholder="Cuantas sedes tienes, que problema quieres resolver..." />
          </label>
          {feedback && <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted">{feedback}</p>}
          <button className="btn-primary h-11" onClick={submitBusinessLead} disabled={loading || !ownerName || !businessName || !email}>
            {loading ? "Enviando..." : "Solicitar activacion"}
          </button>
        </div>
      )}
    </div>
  );
}

function AuthFields({
  email,
  password,
  setEmail,
  setPassword
}: {
  email: string;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
}) {
  return (
    <>
      <label className="grid gap-1 text-sm font-bold">
        Correo
        <input
          className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
        />
      </label>
      <label className="grid gap-1 text-sm font-bold">
        Contrasena
        <input
          className="rounded-lg border border-line bg-slate-50 px-3 py-2 font-normal outline-none focus:border-brand-500"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
        />
      </label>
    </>
  );
}
