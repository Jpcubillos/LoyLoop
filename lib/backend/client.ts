"use client";
export const usesDjango = process.env.NEXT_PUBLIC_DJANGO_BUSINESS_API_ENABLED !== "false";

export async function syncBackendSession(accessToken: string | null) {
  if (!usesDjango) return;
  const response = await fetch('/api/backend-session', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({accessToken}),
  });
  if (!response.ok) throw new Error('No pudimos verificar tu sesion. Inicia sesion nuevamente.');
}

export async function backendClient<T>(path:string, method='GET', body?:unknown):Promise<T> {
  if (!/^\/[a-zA-Z0-9_/-]+\/$/.test(path)) throw new Error('Ruta no valida.');
  const response=await fetch('/api/backend'+path,{
    method,headers:{'Content-Type':'application/json'},cache:'no-store',
    ...(body===undefined ? {} : {body:JSON.stringify(body)}),
  });
  if (!response.ok) throw new Error(response.status===401 ? 'Inicia sesion nuevamente.' : 'No pudimos completar la accion. Revisa tus permisos o los datos.');
  return response.status===204 ? undefined as T : await response.json() as T;
}
