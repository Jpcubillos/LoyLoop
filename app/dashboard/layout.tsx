import { DashboardShell } from "@/components/dashboard-shell";
import { AuthGate } from "@/components/auth-gate";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate allow={["business"]}>
      <DashboardShell>{children}</DashboardShell>
    </AuthGate>
  );
}
