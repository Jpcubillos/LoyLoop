import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { supabase } from "@/lib/supabase";

export function SessionLifecycle() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    function update(state: string) {
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    }
    update(AppState.currentState);
    const listener = AppState.addEventListener("change", update);
    return () => {
      listener.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);
  return null;
}
