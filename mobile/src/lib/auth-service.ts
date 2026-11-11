import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authErrorMessage,
  isNeutralEmailResponse,
  normalizeEmail,
  validateEmail,
  validateNewPassword,
} from "./auth-rules";
type AuthClient = Pick<SupabaseClient, "auth" | "rpc">;

export function createCustomerAuth(
  client: AuthClient,
  configured: boolean,
  recoveryAuth = client.auth,
) {
  function requireService() {
    if (!configured)
      throw new Error("El acceso no está disponible. Inténtalo más tarde.");
  }
  async function prepareIdentity() {
    const { data, error } = await client.rpc(
      "ensure_loyloop_customer_identity",
    );
    if (error || typeof data !== "string") {
      await client.auth.signOut({ scope: "local" });
      throw new Error(
        "No pudimos preparar tu perfil. Inténtalo más tarde o contacta con soporte.",
      );
    }
  }
  return {
    async signIn(email: string, password: string) {
      requireService();
      validateEmail(email);
      if (!password) throw new Error("Ingresa tu contraseña.");
      const { data, error } = await client.auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });
      if (error || !data.session)
        throw new Error(authErrorMessage(error, "signin"));
      await prepareIdentity();
      return data.session;
    },
    async signUp(
      email: string,
      password: string,
      confirmation: string,
      name: string,
    ) {
      requireService();
      validateEmail(email);
      validateNewPassword(password, confirmation);
      const { data, error } = await client.auth.signUp({
        email: normalizeEmail(email),
        password,
        options: { data: { full_name: name.trim() } },
      });
      if (error && !isNeutralEmailResponse(error))
        throw new Error(authErrorMessage(error, "signup"));
      // Supabase can obfuscate an existing account: never inspect identities.
      if (data?.session) await prepareIdentity();
      return data?.session ?? null;
    },
    async confirmRegistration(email: string, token: string) {
      requireService();
      validateEmail(email);
      if (!/^\d{6,10}$/.test(token.trim()))
        throw new Error("Ingresa el código numérico de tu correo.");
      const { data, error } = await client.auth.verifyOtp({
        email: normalizeEmail(email),
        token: token.trim(),
        type: "signup",
      });
      if (error || !data.session)
        throw new Error(authErrorMessage(error, "verify"));
      await prepareIdentity();
      return data.session;
    },
    async resendRegistration(email: string) {
      requireService();
      validateEmail(email);
      const { error } = await client.auth.resend({
        type: "signup",
        email: normalizeEmail(email),
      });
      if (error && !isNeutralEmailResponse(error))
        throw new Error(authErrorMessage(error, "signup"));
    },
    async requestRecovery(email: string) {
      requireService();
      validateEmail(email);
      const { error } = await recoveryAuth.resetPasswordForEmail(
        normalizeEmail(email),
      );
      if (error && !isNeutralEmailResponse(error))
        throw new Error(authErrorMessage(error, "recovery"));
    },
    async recoverPassword(
      email: string,
      token: string,
      password: string,
      confirmation: string,
    ) {
      requireService();
      validateEmail(email);
      validateNewPassword(password, confirmation);
      if (!/^\d{6,10}$/.test(token.trim()))
        throw new Error("Ingresa el código numérico de tu correo.");
      const { data, error } = await recoveryAuth.verifyOtp({
        email: normalizeEmail(email),
        token: token.trim(),
        type: "recovery",
      });
      if (error || !data.session)
        throw new Error(authErrorMessage(error, "verify"));
      try {
        const updated = await recoveryAuth.updateUser({ password });
        if (updated.error)
          throw new Error(authErrorMessage(updated.error, "password"));
      } finally {
        // Recovery never leaves a temporary session available as normal access.
        const result = await recoveryAuth.signOut({ scope: "global" });
        if (result.error) await recoveryAuth.signOut({ scope: "local" });
        if (recoveryAuth !== client.auth) {
          const current = await client.auth.getSession();
          if (current.data.session?.user.id === data.session.user.id) {
            const cleared = await client.auth.signOut({ scope: "local" });
            if (cleared.error)
              throw new Error(authErrorMessage(cleared.error, "signout"));
          }
        }
      }
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: "local" });
      return {
        error: error ? new Error(authErrorMessage(error, "signout")) : null,
      };
    },
  };
}
