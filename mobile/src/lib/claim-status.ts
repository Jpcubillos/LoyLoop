import { businessApi } from "./business-api";
export async function readClaimStatus(code:string) {
  return businessApi<{status:string;expiresAt:string}>(`/claim-requests/${code}/`);
}
