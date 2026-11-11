import { supabase } from "@/lib/supabase";

export async function currentCustomerId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) return null;
  const result = await supabase.rpc("ensure_loyloop_customer_identity");
  if (result.error || typeof result.data !== "string")
    throw new Error(
      "No pudimos cargar tu perfil. Inténtalo más tarde o contacta con soporte.",
    );
  return result.data;
}
