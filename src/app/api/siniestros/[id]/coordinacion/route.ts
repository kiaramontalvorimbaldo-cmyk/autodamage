import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requerirSesion } from '@/lib/session';
import { AppError, toErrorResponse } from '@/lib/errors';
import { createAuthRouteClient } from '@/infrastructure/supabase/route-client';
import { SupabaseCaseCoordination } from '@/infrastructure/repositories/case-coordination';

const accion = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('mensaje'),
    id: z.string().uuid(),
    contenido: z.string().trim().min(1).max(2000),
  }),
  z.object({
    tipo: z.literal('entrega'),
    fecha: z.string().date(),
    anterior: z.string().date().nullable(),
  }),
]);
const cursor = z
  .string()
  .regex(/^[1-9]\d{0,18}$/)
  .pipe(z.string().refine((n) => BigInt(n) <= BigInt('9223372036854775807')));

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requerirSesion(request, ['TALLER', 'PERITO']);
    if ('respuesta' in auth) return auth.respuesta;
    const id = z
      .string()
      .uuid()
      .safeParse((await params).id);
    const antes = cursor
      .optional()
      .safeParse(request.nextUrl.searchParams.get('antes') ?? undefined);
    if (!id.success || !antes.success)
      throw new AppError('VALIDACION_ERROR', 400, 'Caso o página inválidos.');
    const { supabase, withCookies } = createAuthRouteClient(request);
    const datos = await new SupabaseCaseCoordination(supabase).consultar(id.data, antes.data);
    return withCookies(
      NextResponse.json(datos, { headers: { 'Cache-Control': 'private, no-store' } }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requerirSesion(request, ['TALLER', 'PERITO']);
    if ('respuesta' in auth) return auth.respuesta;
    const id = z
      .string()
      .uuid()
      .safeParse((await params).id);
    const body = accion.safeParse(await request.json().catch(() => null));
    if (!id.success || !body.success)
      throw new AppError('VALIDACION_ERROR', 400, 'Revisa los datos ingresados.');
    if (body.data.tipo === 'entrega' && auth.sesion.rol !== 'TALLER')
      throw new AppError('SIN_PERMISO', 403, 'La fecha de entrega la establece el taller.');
    const { supabase, withCookies } = createAuthRouteClient(request);
    const repo = new SupabaseCaseCoordination(supabase);
    if (body.data.tipo === 'mensaje') await repo.enviar(id.data, body.data.id, body.data.contenido);
    else await repo.programar(id.data, body.data.fecha, body.data.anterior);
    return withCookies(NextResponse.json({ ok: true }));
  } catch (error) {
    return toErrorResponse(error);
  }
}
