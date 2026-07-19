"use client";

import { Bell, CreditCard, LogOut, ShieldCheck, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const actions = [
  { label: "Conectar MiniPay", icon: Wallet },
  { label: "Metodos de pago", icon: CreditCard },
  { label: "Notificaciones", icon: Bell },
  { label: "Privacidad y seguridad", icon: ShieldCheck }
];

export function CustomerProfileActions() {
  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="space-y-3">
      {actions.map((action) => (
        <button key={action.label} className="flex w-full items-center gap-3 rounded-lg border border-line bg-white p-4 text-left text-sm font-black">
          <action.icon className="h-5 w-5 text-brand-500" />
          {action.label}
        </button>
      ))}
      <button className="flex w-full items-center gap-3 rounded-lg border border-line bg-white p-4 text-left text-sm font-black" onClick={signOut}>
        <LogOut className="h-5 w-5 text-brand-500" />
        Cerrar sesion
      </button>
    </div>
  );
}
