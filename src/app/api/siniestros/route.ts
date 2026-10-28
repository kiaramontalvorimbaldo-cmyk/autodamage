import { NextRequest, NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { requerirSesion } from '@/lib/session';
import { crearSiniestroSchema, listaSiniestrosSchema } from '@/application/validations/siniestro';
import { createClaim } from '@/application/use-cases/create-claim';
import { listClaims } from '@/application/use-cases/list-claims';
import { getClaimRepository } from '@/composition';
import { clockDelSistema } from '@/application/ports/clock';

/** Crea un siniestro (rol ASEGURADO). */
export async function POST(request: NextRequest) {
  const auth = await requerirSesion(request, ['ASEGURADO']);
  if ('respuesta' in auth) return auth.respuesta;

  try {
    const crudo = await request.json();
    const parseado = crearSiniestroSchema.safeParse(crudo);
    if (!parseado.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDACION_ERROR',
            message: 'Los datos del siniestro son inválidos',
            details: parseado.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const siniestro = await createClaim(
      {
        repositorio: getClaimRepository(),
        reloj: clockDelSistema,
      },
      {
        aseguradoId: auth.sesion.usuarioId,
        id: parseado.data.solicitud_id,
        vehiculoId: parseado.data.vehiculo_id,
        descripcion: parseado.data.descripcion ?? null,
        latitud: parseado.data.latitud,
        longitud: parseado.data.longitud,
        fechaIncidente: parseado.data.fecha_incidente,
      },
    );

    return NextResponse.json({ id: siniestro.id, estado: siniestro.estado }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Lista paginada de siniestros.
 * ASEGURADO: solo los suyos · PERITO/ADMIN: todos (con filtros).
 */
export async function GET(request: NextRequest) {
  const auth = await requerirSesion(request, ['ASEGURADO', 'PERITO', 'ADMIN']);
  if ('respuesta' in auth) return auth.respuesta;

  try {
    const parseado = listaSiniestrosSchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parseado.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDACION_ERROR',
            message: 'Los parámetros de lista son inválidos',
            details: parseado.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const resultado = await listClaims(
      { repositorio: getClaimRepository() },
      auth.sesion.usuarioId,
      auth.sesion.rol,
      {
        ruta: parseado.data.ruta,
        estado: parseado.data.estado,
        page: parseado.data.page,
        pageSize: parseado.data.pageSize,
        bandeja: parseado.data.bandeja,
      },
    );

    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
