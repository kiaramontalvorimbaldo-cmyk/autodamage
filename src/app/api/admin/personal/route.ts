import { NextRequest, NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { requerirSesion } from '@/lib/session';
import { crearPersonalSchema } from '@/application/validations/personal';
import { crearPersonal } from '@/application/use-cases/manage-staff';
import { getStaffRepository } from '@/composition';

/** Crea personal (PERITO o TALLER). Solo ADMIN. */
export async function POST(request: NextRequest) {
  const auth = await requerirSesion(request, ['ADMIN']);
  if ('respuesta' in auth) return auth.respuesta;

  try {
    const crudo = await request.json();
    const parseado = crearPersonalSchema.safeParse(crudo);
    if (!parseado.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDACION_ERROR',
            message: 'Los datos del personal son inválidos',
            details: parseado.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const input = parseado.data;
    const creado = await crearPersonal(
      { staffRepository: getStaffRepository() },
      {
        tipo: input.tipo,
        nombre: input.nombre,
        email: input.email,
        numeroLicencia: input.tipo === 'PERITO' ? input.numero_licencia : undefined,
        nombreTaller: input.tipo === 'TALLER' ? input.nombre_taller : undefined,
        direccion: input.tipo === 'TALLER' ? input.direccion : undefined,
        telefono: input.tipo === 'TALLER' ? input.telefono : undefined,
      },
    );

    return NextResponse.json(
      {
        usuarioId: creado.usuarioId,
        rol: creado.rol,
        passwordTemporal: creado.passwordTemporal,
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
