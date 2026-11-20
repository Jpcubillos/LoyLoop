import { supabase } from "@/lib/supabase";
import { businessApi } from "./business-api";

export async function currentCustomerId():Promise<string|null> {
  const {data,error}=await supabase.auth.getSession();
  if(error) throw error;
  if(!data.session) return null;
  const identity=await businessApi<{customer_id:string}>("/customer-identity/","POST",{});
  if(typeof identity.customer_id!=="string") throw new Error("No pudimos cargar tu perfil.");
  return identity.customer_id;
}
