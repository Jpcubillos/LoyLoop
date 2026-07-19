"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const db = supabase as any;

type AccountType = "business" | "customer";
type BusinessRole = "owner" | "manager" | "cashier";

type AppUser = {
  email: string;
  account_type: AccountType;
  business_role: BusinessRole | null;
  active: boolean;
};

const businessAccess: Record<BusinessRole, string[]> = {
  owner: ["/dashboard"],
  manager: [
    "/dashboard",
    "/dashboard/clientes",
    "/dashboard/recompensas",
    "/dashboard/misiones",
    "/dashboard/campanas",
    "/dashboard/validar",
    "/dashboard/qr",
    "/dashboard/analiticas"
  ],
  cashier: ["/dashboard", "/dashboard/validar", "/dashboard/qr"]
};

function canAccessDashboard(pathname: string, role: BusinessRole | null) {
  if (!role) return false;
  const allowedPaths = businessAccess[role] ?? [];
  return allowedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

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
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const { data: appUser, error } = await db
        .from("app_users")
        .select("email, account_type, business_role, active")
        .eq("email", userEmail)
        .maybeSingle();

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
