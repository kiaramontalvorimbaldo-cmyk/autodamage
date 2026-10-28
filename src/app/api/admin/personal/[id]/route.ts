import { NextRequest, NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { requerirSesion } from '@/lib/session';
import { cambiarActivoSchema } from '@/application/validations/personal';
import { cambiarActivoPersonal } from '@/application/use-cases/manage-staff';
import { getStaffRepository } from '@/composition';

/** Activa o desactiva personal (PERITO o TALLER). Solo ADMIN. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requerirSesion(request, ['ADMIN']);
  if ('respuesta' in auth) return auth.respuesta;

  try {
    const { id } = await params;
    const crudo = await request.json();
    const parseado = cambiarActivoSchema.safeParse(crudo);
    if (!parseado.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDACION_ERROR',
            message: 'El estado activo es inválido',
            details: parseado.error.issues,
          },
        },
        { status: 400 },
      );
    }

    await cambiarActivoPersonal(
      { staffRepository: getStaffRepository() },
      id,
      parseado.data.activo,
    );
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
