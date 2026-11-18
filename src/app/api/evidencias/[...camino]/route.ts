import { NextRequest } from 'next/server';
import { LocalStorageService, verificarFirma } from '@/infrastructure/local/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ camino: string[] }> },
) {
  if (process.env.DATA_BACKEND !== 'local') return new Response(null, { status: 404 });
  try {
    const path = (await params).camino.join('/');
    if (
      !verificarFirma(
        path,
        request.nextUrl.searchParams.get('expira') ?? '',
        request.nextUrl.searchParams.get('firma') ?? '',
      )
    )
      return new Response(null, { status: 403 });
    const data = await new LocalStorageService().descargar(path);
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
