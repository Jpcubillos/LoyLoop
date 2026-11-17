import { NextResponse } from 'next/server';
import { BackendError } from '@/lib/backend/server';
import { createClaimRequest } from '@/lib/claims';

export async function POST(request:Request) {
  const authorization=request.headers.get('authorization');
  const bearer=authorization?.startsWith('Bearer ')?authorization.slice(7):undefined;
  if(!bearer && request.headers.get('origin')!==new URL(request.url).origin) return NextResponse.json({ok:false},{status:403});
  try {
    const body=await request.json();
    const result=await createClaimRequest({actionType:body.actionType,businessSlug:body.businessSlug,payload:body.payload??{}},bearer);
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    return NextResponse.json({ok:false,message:'No pudimos completar la accion.'},{status:error instanceof BackendError?error.status:400});
  }
}
