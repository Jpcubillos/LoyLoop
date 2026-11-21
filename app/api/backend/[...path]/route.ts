import { NextResponse } from 'next/server';
import { backendRequest, BackendError } from '@/lib/backend/server';

async function proxy(request:Request,context:{params:Promise<{path:string[]}>}) {
  const {path}=await context.params;
  if (!path.length || path.some(part=> !/^[A-Za-z0-9_-]+$/.test(part)) || path.join('/').length>500) return NextResponse.json({ok:false},{status:400});
  if (request.method!=='GET' && request.headers.get('origin')!==new URL(request.url).origin) return NextResponse.json({ok:false},{status:403});
  try {
    let body:unknown=undefined;
    if (request.method!=='GET') {
      const text=await request.text();
      if (text.length>32768) return NextResponse.json({ok:false},{status:413});
      body=text ? JSON.parse(text) : undefined;
    }
    const url=new URL(request.url);
    const search=url.search;
    const result=await backendRequest('/'+path.join('/')+'/'+search,request.method,body);
    return result===undefined ? new NextResponse(null,{status:204}) : NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    return NextResponse.json({ok:false,message:'No pudimos completar la accion.'},{status:error instanceof BackendError ? error.status : 400});
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
