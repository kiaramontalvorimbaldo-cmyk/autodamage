import { NextRequest, NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { requerirSesion } from '@/lib/session';
import { vehiculoSchema } from '@/application/validations/vehicle';
import { createVehicle } from '@/application/use-cases/manage-vehicle';
import { getClaimRepository } from '@/composition';

/** Crea un vehículo para el asegurado autenticado. */
export async function POST(request: NextRequest) {
  const auth = await requerirSesion(request, ['ASEGURADO']);
  if ('respuesta' in auth) return auth.respuesta;

  try {
    const crudo = await request.json();
    const parseado = vehiculoSchema.safeParse(crudo);
    if (!parseado.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDACION_ERROR',
            message: 'Los datos del vehículo son inválidos',
            details: parseado.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const vehiculo = await createVehicle(
      { repositorio: getClaimRepository() },
      {
        aseguradoId: auth.sesion.usuarioId,
        matricula: parseado.data.matricula,
        marca: parseado.data.marca,
        modelo: parseado.data.modelo,
        numeroPoliza: parseado.data.numero_poliza,
      },
    );

    return NextResponse.json(vehiculo, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Lista los vehículos del asegurado autenticado. */
export async function GET(request: NextRequest) {
  const auth = await requerirSesion(request, ['ASEGURADO']);
  if ('respuesta' in auth) return auth.respuesta;

  try {
    const vehiculos = await getClaimRepository().listarVehiculosPorAsegurado(auth.sesion.usuarioId);
    return NextResponse.json(vehiculos);
  } catch (error) {
    return toErrorResponse(error);
  }
}
