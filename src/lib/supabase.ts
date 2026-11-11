import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createSecureSessionStorage } from "@/lib/secure-session-storage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const isBrowser = Platform.OS === "web" && typeof window !== "undefined";
const shouldPersistSession = Platform.OS !== "web" || isBrowser;
const browserStorage = isBrowser
  ? {
      getItem: (key: string) => window.localStorage.getItem(key),
      setItem: (key: string, value: string) =>
        window.localStorage.setItem(key, value),
      removeItem: (key: string) => window.localStorage.removeItem(key),
    }
  : undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabasePublishableKey || "placeholder-key",
  {
    auth: {
      storage:
        Platform.OS === "web"
          ? browserStorage
          : createSecureSessionStorage(SecureStore, AsyncStorage),
      ...(Platform.OS !== "web" ? { lock: processLock } : {}),
      autoRefreshToken: shouldPersistSession,
      persistSession: shouldPersistSession,
      detectSessionInUrl: false,
    },
  },
);

// OTP recovery must never persist a temporary authenticated session, including
// if the app closes between verification and the password update.
export const recoveryAuth = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabasePublishableKey || "placeholder-key",
  {
    auth: {
      storageKey: "loyloop-recovery-ephemeral",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
).auth;
