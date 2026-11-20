import { businessApi } from "./business-api";
export type ClaimAction="stamp_add"|"stamp_redeem"|"discount_redeem"|"points_boost";
type Input={actionType:ClaimAction;businessSlug:string;payload?:Record<string,unknown>};

export async function createClaimRequest({actionType,businessSlug,payload={}}:Input) {
  return businessApi<{code:string;expiresAt:string}>("/claim-requests/","POST",{actionType,businessSlug,payload});
}
