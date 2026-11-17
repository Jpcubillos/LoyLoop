/** Business writes live in Django. No anonymous database mutation fallback. */
import 'server-only';
import { backendBusiness, backendRequest } from '@/lib/backend/server';
export type ClaimAction='stamp_add'|'stamp_redeem'|'discount_redeem'|'points_boost';

export async function createClaimRequest(input:{actionType:ClaimAction;businessSlug:string;payload?:Record<string,unknown>},bearer?:string) {
  return backendRequest<{ok:boolean;code:string;expiresAt:string}>('/claim-requests/','POST',input,bearer);
}

export async function validateClaimRequest(code:string) {
  const business=await backendBusiness();
  return backendRequest<{ok:boolean;message:string}>(`/businesses/${business.id}/validate-claim/`,'POST',{code});
}
