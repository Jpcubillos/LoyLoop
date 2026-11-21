/** Business writes live in Django. No anonymous database mutation fallback. */
import 'server-only';
import { backendBusiness, backendRequest } from '@/lib/backend/server';
export type ClaimAction='stamp_add'|'stamp_redeem'|'discount_redeem'|'points_boost';

export async function createClaimRequest(input:{actionType:ClaimAction;businessSlug:string;payload?:Record<string,unknown>},bearer?:string) {
  return backendRequest<{ok:boolean;code:string;manualCode?:string;expiresAt:string}>('/claim-requests/','POST',input,bearer);
}

export async function previewClaimRequest(code:string) {
  const business=await backendBusiness();
  return backendRequest<{
    ok:boolean;
    claimId:string;
    code:string;
    customerName:string;
    customerId:string;
    actionType:string;
    benefitTitle:string;
    detail:string;
    expiresAt:string;
    status:string;
    canConfirm:boolean;
  }>(`/businesses/${business.id}/claims/preview/`,'POST',{code});
}

export async function validateClaimRequest(code:string) {
  const business=await backendBusiness();
  return backendRequest<{ok:boolean;message:string;customerName?:string;actionType?:string}>(`/businesses/${business.id}/validate-claim/`,'POST',{code});
}
