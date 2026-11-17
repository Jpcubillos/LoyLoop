"use client";
import { syncBackendSession, backendClient } from "@/lib/backend/client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase/client";



type AccountType = "business" | "customer";
type BusinessRole = "owner" | "manager" | "cashier";

type AppUser = {
  email: string;
  account_type: AccountType;
  business_role: BusinessRole | null;
  active: boolean;
};

import { canAccessDashboard } from "@/lib/auth-access";

export function AuthGate({
  children,
  allow
}: {
  children: React.ReactNode;
  allow: AccountType[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");
  const [message, setMessage] = useState("Validando sesion...");

  const allowKey = useMemo(() => allow.join(","), [allow]);

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      setStatus("checking");
      const { data: sessionData } = await supabase.auth.getSession();
      const userEmail = sessionData.session?.user.email?.toLowerCase();

      if (!userEmail) {
        await syncBackendSession(null).catch(() => {});
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      let appUser: AppUser | null = null;
      let error: unknown = null;
      try {
        await syncBackendSession(sessionData.session!.access_token);
        const session = await backendClient<{email:string;active:boolean;account_type:AccountType|null;business_role:BusinessRole|null}>("/session/");
        if (session.account_type) appUser = {...session,account_type:session.account_type};
      } catch (failure) { error = failure; }

      if (!mounted) return;

      if (error || !appUser) {
        setMessage("Tu usuario aun no tiene perfil en LoyLoop. Pide activacion o vuelve a registrarte como cliente.");
        setStatus("denied");
        return;
      }

      if (!appUser.active) {
        setMessage("Tu usuario esta inactivo. Contacta al comercio para reactivarlo.");
        setStatus("denied");
        return;
      }

      if (!allow.includes(appUser.account_type)) {
        router.replace(appUser.account_type === "business" ? "/dashboard" : "/c");
        return;
      }

      if (appUser.account_type === "business" && pathname.startsWith("/dashboard") && !canAccessDashboard(pathname, appUser.business_role)) {
        setMessage("Tu rol no tiene permiso para entrar a este apartado.");
        setStatus("denied");
        return;
      }

      setStatus("allowed");
    }

    checkAccess();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      checkAccess();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [allowKey, pathname, router]);

  if (status === "checking") {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="rounded-lg border border-line bg-white p-5 text-sm font-bold text-muted shadow-soft">
          {message}
        </div>
      </main>
    );
  }

  if (status === "denied") {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="max-w-md rounded-lg border border-line bg-white p-6 text-center shadow-soft">
          <ShieldAlert className="mx-auto h-8 w-8 text-amber-600" />
          <h1 className="mt-3 text-xl font-black text-ink">Acceso restringido</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{message}</p>
          <button className="btn-primary mt-5 w-full" onClick={() => router.push("/login")}>
            Volver al login
          </button>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
