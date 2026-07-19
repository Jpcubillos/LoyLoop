import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        <Suspense fallback={<div className="rounded-lg border border-line bg-white p-6 shadow-soft">Cargando...</div>}>
          <AuthForm />
        </Suspense>
      </div>
    </main>
  );
}
