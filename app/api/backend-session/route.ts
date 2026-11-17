import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { SESSION_COOKIE, usesDjango } from '@/lib/backend/server';

export async function POST(request:Request) {
  if (!usesDjango) return NextResponse.json({ok:false},{status:503});
  if (request.headers.get('origin')!==new URL(request.url).origin) return NextResponse.json({ok:false},{status:403});
  const text=await request.text();
  if (text.length>16384) return NextResponse.json({ok:false},{status:413});
  let token:unknown;
  try { token=JSON.parse(text).accessToken; } catch { return NextResponse.json({ok:false},{status:400}); }
  const response=NextResponse.json({ok:true});
  response.headers.set('Cache-Control','no-store');
  if (token===null) { response.cookies.delete(SESSION_COOKIE);return response; }
  if (typeof token!=='string' || token.length>8192 || !/^[A-Za-z0-9._-]+$/.test(token)) return NextResponse.json({ok:false},{status:401});
  const {data,error}=await supabase.auth.getUser(token);
  if (error || !data.user?.email_confirmed_at || data.user.is_anonymous) return NextResponse.json({ok:false},{status:401});
  response.cookies.set(SESSION_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:3600});
  return response;
}
