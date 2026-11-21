/** Authenticated transport. Never retries a write through a different backend. */
export function createBusinessApi(
  baseUrl: string,
  token: () => Promise<string | null>,
  transport: typeof fetch = fetch,
  publicDiscovery = false,
) {
  return async function request<T>(path: string, method = "GET", body?: unknown, customHeaders?: Record<string, string>): Promise<T> {
    let base: URL;
    try { base = new URL(baseUrl); } catch { throw new Error("El servicio de LoyLoop no esta configurado."); }
    if (base.username || base.password || base.search || base.hash || base.pathname !== "/" ||
      (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) ||
      !/^\/[a-zA-Z0-9_/-]+\/(?:\?[a-zA-Z0-9_=&%-]*)?$/.test(path)) {
      throw new Error("La direccion del servicio de LoyLoop no es valida.");
    }
    const accessToken = await token();
    if (!accessToken && !(publicDiscovery && method === "GET" && /^\/discovery\/(?:[a-zA-Z0-9_-]+\/)?(?:\?[a-zA-Z0-9_=&%-]*)?$/.test(path))) throw new Error("Inicia sesion para continuar.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await transport(`${base.origin}/api${path}`, {
        method, signal: controller.signal,
        headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), "Content-Type": "application/json", ...(customHeaders ?? {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) {
        // Never surface a proxy page, raw database diagnostic or token to UI.
        if (response.status === 401) throw new Error("Tu sesion ha vencido. Inicia sesion nuevamente.");
        if (response.status === 403) throw new Error("Tu cuenta no tiene permiso para esta accion.");
        if (response.status === 409) throw new Error("Este QR ya fue procesado o ha expirado.");
        if (response.status === 400) throw new Error("Revisa los datos o la disponibilidad e intenta nuevamente.");
        throw new Error("No pudimos completar la accion. Intenta mas tarde.");
      }
      if (response.status === 204) return undefined as T;
      return await response.json() as T;
    } catch (error) {
      if (error instanceof TypeError || (error instanceof Error && error.name === "AbortError")) {
        throw new Error("No se pudo conectar con el servidor de LoyLoop.");
      }
      throw error;
    } finally { clearTimeout(timeout); }
  };
}
