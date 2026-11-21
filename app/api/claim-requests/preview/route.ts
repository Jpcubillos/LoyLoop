import { NextResponse } from 'next/server';
import { BackendError } from '@/lib/backend/server';
import { previewClaimRequest } from '@/lib/claims';

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  try {
    const body = await request.json();
    const result = await previewClaimRequest(String(body.code ?? ''));
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'No pudimos previsualizar el beneficio.' },
      { status: error instanceof BackendError ? error.status : 400 }
    );
  }
}
