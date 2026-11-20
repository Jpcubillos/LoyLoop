type BusinessRole = "owner" | "manager" | "cashier";

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

export function canAccessDashboard(pathname: string, role: BusinessRole | null) {
  if (!role) return false;
  if (role === "owner") return true;
  const allowedPaths = businessAccess[role] ?? [];
  return allowedPaths.some((path) => pathname === path || (path !== "/dashboard" && pathname.startsWith(`${path}/`)));
}
