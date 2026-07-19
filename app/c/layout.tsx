import { AuthGate } from "@/components/auth-gate";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate allow={["customer"]}>{children}</AuthGate>;
}
