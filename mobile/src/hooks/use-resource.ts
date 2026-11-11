import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";

export function useResource<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const value = await loader();
      if (current === generation.current) setData(value);
    } catch (err) {
      if (current === generation.current)
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar la información.",
        );
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [loader]);
  useFocusEffect(
    useCallback(() => {
      // A different account may have signed in while this route was unfocused.
      setData(undefined);
      void reload();
      let userId: string | null | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "INITIAL_SESSION") {
          userId = session?.user.id ?? null;
          return;
        }
        const nextId = session?.user.id ?? null;
        if (nextId === userId && event !== "USER_UPDATED") return;
        userId = nextId;
        generation.current++;
        setData(undefined);
        setError("");
        setLoading(true);
        // Auth callbacks must finish before loaders call Auth again.
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          void reload();
        }, 0);
      });
      return () => {
        generation.current++;
        subscription.unsubscribe();
        if (timer) clearTimeout(timer);
      };
    }, [reload]),
  );
  return { data, error, loading, reload, setData };
}
