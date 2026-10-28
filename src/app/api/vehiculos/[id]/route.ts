import { NextRequest, NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { requerirSesion } from '@/lib/session';
import { vehiculoSchema } from '@/application/validations/vehicle';
import { deleteVehicle, updateVehicle } from '@/application/use-cases/manage-vehicle';
import { getClaimRepository } from '@/composition';

function respuestaValidacion(issues: unknown): Response {
  return NextResponse.json(
    { error: { code: 'VALIDACION_ERROR', message: 'Revisa los datos ingresados', details: issues } },
    { status: 400 },
  );
}

/** Edita un vehículo. Solo su dueño (ASEGURADO). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requerirSesion(request, ['ASEGURADO']);
  if ('respuesta' in auth) return auth.respuesta;

  try {
    const { id } = await params;
    const crudo = (await request.json()) as Record<string, unknown>;
    const entrada = {
      ...(crudo.matricula !== undefined ? { matricula: String(crudo.matricula) } : {}),
      ...(crudo.marca !== undefined ? { marca: String(crudo.marca) } : {}),
      ...(crudo.modelo !== undefined ? { modelo: String(crudo.modelo) } : {}),
      ...(crudo.numero_poliza !== undefined ? { numero_poliza: String(crudo.numero_poliza) } : {}),
    };

    if (Object.keys(entrada).length === 0) {
      return respuestaValidacion([]);
    }

    const parseado = vehiculoSchema.partial().safeParse(entrada);
    if (!parseado.success) {
      return respuestaValidacion(parseado.error.issues);
    }

    const vehiculo = await updateVehicle(
      { repositorio: getClaimRepository() },
      {
        aseguradoId: auth.sesion.usuarioId,
        vehiculoId: id,
        ...parseado.data,
      },
    );

    return NextResponse.json(vehiculo);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Elimina un vehículo sin siniestros asociados. Solo su dueño (ASEGURADO). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requerirSesion(request, ['ASEGURADO']);
  if ('respuesta' in auth) return auth.respuesta;

  try {
    const { id } = await params;
    await deleteVehicle(
      { repositorio: getClaimRepository() },
      { aseguradoId: auth.sesion.usuarioId, vehiculoId: id },
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}