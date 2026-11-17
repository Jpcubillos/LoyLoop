import { businessApi } from "./business-api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { isDemo } from "@/lib/loyloop-data";
export type ProfileField = "name" | "phone" | "birthDate" | "avatar";
export async function updateProfile(field: ProfileField, value: string) {
  if (isDemo) {
    const saved = JSON.parse(
      (await AsyncStorage.getItem("loyloop.demo.profile")) || "{}",
    );
    await AsyncStorage.setItem(
      "loyloop.demo.profile",
      JSON.stringify({ ...saved, [field]: value }),
    );
    return;
  }
  const map = {
    name: "full_name",
    phone: "phone",
    birthDate: "birth_date",
    avatar: "avatar_url",
  };
  const { error } = await supabase.auth.updateUser({
    data: { [map[field]]: value },
  });
  if (error) throw error;
}
export async function requestEmailChange(email: string) {
  if (isDemo)
    throw new Error(
      "Inicia sesión con una cuenta real para verificar un correo.",
    );
  const readiness=await businessApi<{ready:boolean}>("/account/readiness/");
  if(!readiness.ready) throw new Error("El servicio de perfil se esta actualizando. Intenta mas tarde.");
  const { error } = await supabase.auth.updateUser({
    email: email.trim().toLowerCase(),
  });
  if (error) throw error;
}
export async function verifyEmailChange(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: "email_change",
  });
  if (error) throw error;
  // Secure email change can require confirmation from both email addresses.
  if (data.user?.email?.toLowerCase() !== email.trim().toLowerCase())
    throw new Error(
      "Confirma también el cambio desde tu correo anterior y vuelve a intentarlo.",
    );
}
export async function updatePassword(current: string, next: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user.email)
    throw new Error("Inicia sesión para cambiar tu contraseña.");
  const result = await supabase.auth.signInWithPassword({
    email: session.user.email,
    password: current,
  });
  if (result.error) throw new Error("La contraseña actual no es correcta.");
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) throw error;
}
export async function uploadAvatar(base64: string) {
  if (isDemo) {
    await updateProfile("avatar", `data:image/jpeg;base64,${base64}`);
    return;
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Inicia sesión para actualizar tu avatar.");
  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  if (bytes.byteLength > 2097152)
    throw new Error("Elige una imagen de menos de 2 MB.");
  const path = `${session.user.id}/avatar.jpg`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (error)
    throw new Error("No se pudo guardar el avatar. Inténtalo de nuevo.");
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  await updateProfile("avatar", `${data.publicUrl}?v=${Date.now()}`);
}
export async function deleteAccount() {
  if (isDemo)
    throw new Error("La cuenta de demostración no se puede eliminar.");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Inicia sesión para eliminar tu cuenta.");
  await businessApi("/account/deletion-check/", "POST", {});
  const { error: storageError } = await supabase.storage
    .from("avatars")
    .remove([`${session.user.id}/avatar.jpg`]);
  if (storageError && session.user.user_metadata.avatar_url)
    throw new Error("No pudimos eliminar tu avatar. Inténtalo de nuevo.");
  await businessApi("/account/", "DELETE");
  await supabase.auth.signOut({ scope: "local" });
}
