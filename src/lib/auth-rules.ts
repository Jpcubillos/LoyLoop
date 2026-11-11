export const SIGNUP_NOTICE =
  "Si el correo puede registrarse, recibirás un código para confirmar tu cuenta. Si ya tienes cuenta, inicia sesión o recupera tu acceso.";
export const RECOVERY_NOTICE =
  "Si existe una cuenta para ese correo, recibirás un código para recuperar tu acceso.";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
export function validateEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email)))
    throw new Error("Ingresa un correo válido.");
}
export function validateNewPassword(password: string, confirmation: string) {
  if (password.length < 8)
    throw new Error("Usa una contraseña de al menos 8 caracteres.");
  if (password !== confirmation)
    throw new Error("Las contraseñas no coinciden.");
}
export function isNeutralEmailResponse(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  return [
    "user_already_exists",
    "email_exists",
    "user_not_found",
    "email_not_confirmed",
    "user_banned",
    "over_email_send_rate_limit",
  ].includes(code || "");
}
export function authErrorMessage(
  error: unknown,
  operation:
    "signin" | "signup" | "verify" | "recovery" | "password" | "signout",
) {
  const details = error as {
    code?: string;
    status?: number;
    name?: string;
  } | null;
  if (details?.status === 429 || details?.code === "over_request_rate_limit")
    return "Hay demasiados intentos. Espera unos minutos y vuelve a intentar.";
  if (details?.name === "AuthRetryableFetchError" || details?.status === 0)
    return "No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.";
  if (operation === "signup" && details?.code === "weak_password")
    return "La contraseña no cumple los requisitos de seguridad. Usa una más larga y difícil de adivinar.";
  if (operation === "verify")
    return "El código no es válido o venció. Solicita uno nuevo e inténtalo otra vez.";
  if (operation === "signin")
    return "No pudimos iniciar sesión. Revisa tus datos o recupera tu acceso.";
  if (operation === "password")
    return "No pudimos guardar la contraseña. Usa una distinta que cumpla los requisitos y solicita otro código si venció.";
  if (operation === "signout")
    return "No pudimos cerrar la sesión. Inténtalo de nuevo.";
  return "No pudimos completar la solicitud. Inténtalo de nuevo más tarde.";
}
