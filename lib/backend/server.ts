import 'server-only';
import { cookies } from 'next/headers';

export const usesDjango = process.env.NEXT_PUBLIC_DJANGO_BUSINESS_API_ENABLED !== 'false';
export const SESSION_COOKIE='loyloop_backend_access';
export type BackendSession={id:string;email:string;account_type:'business'|'customer'|null;business_role:'owner'|'manager'|'cashier'|null;business_id:string|null;active:boolean;businesses:{id:string;slug:string;name:string;role:string}[]};
export class BackendError extends Error {
  constructor(public status:number) { super(status===401 ? 'Inicia sesion nuevamente.' : 'No pudimos completar la accion. Revisa tus permisos o los datos.'); }
}

export async function backendRequest<T>(path:string, method='GET', body?:unknown, bearer?:string):Promise<T> {
  if (!usesDjango) throw new BackendError(503);
  const publicLead=path==='/business-leads/' && method==='POST';
  const token=bearer ?? (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token && !publicLead) throw new BackendError(401);
  let base:URL;
  try { base=new URL(process.env.LOYLOOP_DJANGO_API_URL || ''); } catch { throw new BackendError(503); }
  if (base.protocol!=='https:' || base.username || base.password || base.search || base.hash || base.pathname!=='/' || !/^\/[a-zA-Z0-9_/-]+\/(?:\?[a-zA-Z0-9_=&%-]*)?$/.test(path)) throw new BackendError(503);
  let response:Response;
  try {
    response=await fetch(base.origin+'/api'+path,{
      method,cache:'no-store',signal:AbortSignal.timeout(15000),
      headers:{'Content-Type':'application/json',...(token ? {Authorization:`Bearer ${token}`} : {})},
      ...(body===undefined ? {} : {body:JSON.stringify(body)}),
    });
  } catch { throw new BackendError(503); }
  if (!response.ok) throw new BackendError(response.status);
  if (response.status===204) return undefined as T;
  try { return await response.json() as T; } catch { throw new BackendError(502); }
}

export async function backendBusiness() {
  const session=await backendRequest<BackendSession>('/session/');
  const business=session.businesses.find(b=>b.id===session.business_id);
  if (!business || !session.active) throw new BackendError(403);
  return business;
}


export async function dashboardBusiness() {
  try { return await backendBusiness(); }
  catch(error) {
    if(error instanceof BackendError && error.status===401) {
      const {redirect}=await import('next/navigation');
      redirect('/login?next=%2Fdashboard');
    }
    throw error;
  }
}


export async function pageRequest<T>(path:string,method='GET',body?:unknown):Promise<T> {
  try { return await backendRequest<T>(path,method,body); }
  catch(error) {
    if(error instanceof BackendError && error.status===401) {
      const {redirect}=await import('next/navigation');
      redirect('/login?next=%2Fc');
    }
    throw error;
  }
}
