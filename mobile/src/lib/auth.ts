import { currentCustomerId } from "./customer-identity";
import { supabase } from "@/lib/supabase";
import { isSupabaseConfigured, recoveryAuth } from "@/lib/supabase";
import { createCustomerAuth } from "@/lib/auth-service";

const customerAuth = createCustomerAuth(
  supabase,
  isSupabaseConfigured,
  recoveryAuth,
  currentCustomerId,
);
export const signInWithEmail = customerAuth.signIn;
export const signUpWithEmail = customerAuth.signUp;
export const confirmRegistration = customerAuth.confirmRegistration;
export const resendRegistration = customerAuth.resendRegistration;
export const requestRecovery = customerAuth.requestRecovery;
export const recoverPassword = customerAuth.recoverPassword;
export const signOut = customerAuth.signOut;

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
