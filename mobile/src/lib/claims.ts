import { businessApi } from "./business-api";
export type ClaimAction="stamp_add"|"stamp_redeem"|"discount_redeem"|"points_boost";
type Input={actionType:ClaimAction;businessSlug:string;payload?:Record<string,unknown>;idempotencyKey?:string};

export async function createClaimRequest({actionType,businessSlug,payload={},idempotencyKey}:Input) {
  const customHeaders = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined;
  return businessApi<{code:string;manualCode?:string;expiresAt:string}>("/claim-requests/","POST",{actionType,businessSlug,payload},customHeaders);
}
