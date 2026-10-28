import { NextRequest, NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { requerirSesion } from '@/lib/session';
import { metadatosImagenSchema } from '@/application/validations/siniestro';
import { uploadImage } from '@/application/use-cases/upload-image';
import {
  getClaimRepository,
  getImageService,
  getStorageService,
  getAuditRepository,
} from '@/composition';

/**
 * Sube una evidencia a un siniestro (rol ASEGURADO, dueño).
 * multipart/form-data: file (JPEG), capturada_en, latitud,
 * longitud, precision_gps_m, orden, rostros_difuminados.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requerirSesion(request, ['ASEGURADO']);
  if ('respuesta' in auth) return auth.respuesta;

  try {
    const { id } = await params;
    const formData = await request.formData();

    const archivo = formData.get('file');
    if (!(archivo instanceof File)) {
      return NextResponse.json(
        { error: { code: 'ARCHIVO_FALTANTE', message: 'Falta el archivo de imagen' } },
        { status: 400 },
      );
    }

    const capturadaEn = formData.get('capturada_en');
    const latitud = formData.get('latitud');
    const longitud = formData.get('longitud');
    const precisionGpsM = formData.get('precision_gps_m');
    const orden = formData.get('orden');
    const rostrosDifuminados = formData.get('rostros_difuminados');

    const crudo = {
      imagen_id: formData.get('imagen_id') ?? undefined,
      ampliacion_id: formData.get('ampliacion_id') ?? undefined,
      capturada_en: typeof capturadaEn === 'string' ? capturadaEn : undefined,
      latitud: latitud === null || latitud === undefined || latitud === '' ? null : Number(latitud),
      longitud:
        longitud === null || longitud === undefined || longitud === '' ? null : Number(longitud),
      precision_gps_m:
        precisionGpsM === null || precisionGpsM === undefined || precisionGpsM === ''
          ? null
          : Number(precisionGpsM),
      orden: orden === null || orden === undefined ? 0 : Number(orden),
      rostros_difuminados: rostrosDifuminados === 'true',
    };

    const parseados = metadatosImagenSchema.safeParse(crudo);
    if (!parseados.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDACION_ERROR',
            message: 'Los metadatos de la imagen son inválidos',
            details: parseados.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());

    const imagen = await uploadImage(
      {
        repositorio: getClaimRepository(),
        almacen: getStorageService(),
        imagenes: getImageService(),
        auditoria: getAuditRepository(),
      },
      {
        siniestroId: id,
        imagenId: parseados.data.imagen_id,
        ampliacionId: parseados.data.ampliacion_id,
        aseguradoId: auth.sesion.usuarioId,
        archivo: buffer,
        tipoMime: archivo.type,
        capturadaEn: parseados.data.capturada_en,
        latitud: parseados.data.latitud ?? null,
        longitud: parseados.data.longitud ?? null,
        precisionGpsM: parseados.data.precision_gps_m ?? null,
        orden: parseados.data.orden,
        rostrosDifuminados: parseados.data.rostros_difuminados,
        userAgent: request.headers.get('user-agent'),
      },
    );

    return NextResponse.json({ imagen_id: imagen.id }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
