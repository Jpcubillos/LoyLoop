import 'server-only';
import { backendBusiness, backendRequest } from './server';

export async function writeOffer(collection:string,method:'POST'|'PATCH'|'DELETE',values:Record<string,unknown>={},id?:string) {
  if (!['rewards','missions','campaigns'].includes(collection) || (id && !/^[0-9a-f-]{36}$/i.test(id))) throw new Error('Registro no valido.');
  const business=await backendBusiness();
  const {business_id,...body}=values;
  if (business_id && business_id!==business.id) throw new Error('Comercio no valido.');
  await backendRequest(`/businesses/${business.id}/${collection}/${id ? id+'/' : ''}`,method,method==='DELETE' ? undefined : body);
  return {error:null};
}
