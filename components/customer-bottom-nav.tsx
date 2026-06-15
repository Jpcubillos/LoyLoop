import Link from "next/link";
import { Gift, Home, ScanLine, Store, UserRound } from "lucide-react";

const items = [
  { label: "Inicio", href: "/c", icon: Home },
  { label: "Comercios", href: "/c/comercios", icon: Store },
  { label: "Escanear", href: "/c/escanear", icon: ScanLine },
  { label: "Recompensas", href: "/c/recompensas", icon: Gift },
  { label: "Perfil", href: "/c/perfil", icon: UserRound }
];

export function CustomerBottomNav({ active }: { active: string }) {
  return (
    <nav className="fixed bottom-0 left-1/2 grid w-full max-w-md -translate-x-1/2 grid-cols-5 border-t border-line bg-white px-2 py-2 text-[11px] font-bold text-muted">
      {items.map((item) => {
        const isActive = item.label === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`grid place-items-center gap-1 rounded-lg py-1.5 ${
              isActive ? "bg-brand-500 text-white" : ""
            }`}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
