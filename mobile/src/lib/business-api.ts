import { supabase } from "@/lib/supabase";
import { createBusinessApi } from "./business-api-client";

const token = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error("No pudimos verificar tu sesion.");
  return data.session?.access_token ?? null;
};
export const businessApi = createBusinessApi(process.env.EXPO_PUBLIC_LOYLOOP_API_URL || "", token);
export const discoveryApi = createBusinessApi(process.env.EXPO_PUBLIC_LOYLOOP_API_URL || "", token, fetch, true);
