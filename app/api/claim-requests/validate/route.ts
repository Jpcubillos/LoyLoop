import { NextResponse } from 'next/server';
import { BackendError } from '@/lib/backend/server';
import { validateClaimRequest } from '@/lib/claims';

export async function POST(request:Request) {
  if(request.headers.get('origin')!==new URL(request.url).origin) return NextResponse.json({ok:false},{status:403});
  try {
    const body=await request.json();
    const result=await validateClaimRequest(String(body.code??''));
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    return NextResponse.json({ok:false,message:'No pudimos completar la accion.'},{status:error instanceof BackendError?error.status:400});
  }
}
