import { NextRequest, NextResponse } from 'next/server';
import { requerirSesion } from '@/lib/session';
import { localPool } from '@/infrastructure/local/database';
import { toErrorResponse } from '@/lib/errors';

export async function GET(request: NextRequest) {
  const auth = await requerirSesion(request, ['ASEGURADO']);
  if ('respuesta' in auth) return auth.respuesta;
  if (process.env.DATA_BACKEND !== 'local')
    return NextResponse.json({ notificaciones: [], pendientes: 0, disponible: false });
  const after = request.nextUrl.searchParams.get('despues');
  if (after !== null && !/^(0|[1-9][0-9]{0,17})$/.test(after))
    return NextResponse.json(
      { error: { code: 'VALIDACION_ERROR', message: 'Cursor inválido' } },
      { status: 400 },
    );
  try {
    const db = localPool();
    const { rows } = await db.query(
      `SELECT secuencia::text AS id,siniestro_id AS "siniestroId",titulo,creado_en AS "creadoEn",leido_en AS "leidoEn" FROM notificaciones WHERE usuario_id=$1 ${after !== null ? 'AND secuencia > $2 ORDER BY secuencia ASC' : 'ORDER BY secuencia DESC'} LIMIT 50`,
      after !== null ? [auth.sesion.usuarioId, after] : [auth.sesion.usuarioId],
    );
    const count = await db.query(
      'SELECT count(*)::int AS n FROM notificaciones WHERE usuario_id=$1 AND leido_en IS NULL',
      [auth.sesion.usuarioId],
    );
    return NextResponse.json(
      { notificaciones: rows, pendientes: count.rows[0].n, disponible: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
export async function POST(request: NextRequest) {
  const auth = await requerirSesion(request, ['ASEGURADO']);
  if ('respuesta' in auth) return auth.respuesta;
  if (process.env.DATA_BACKEND !== 'local')
    return NextResponse.json(
      { error: { code: 'NO_DISPONIBLE', message: 'Las notificaciones requieren el modo local.' } },
      { status: 409 },
    );
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== 'string' || !/^[1-9][0-9]{0,17}$/.test(body.id))
    return NextResponse.json(
      { error: { code: 'VALIDACION_ERROR', message: 'Selecciona una notificación.' } },
      { status: 400 },
    );
  try {
    const result = await localPool().query(
      'UPDATE notificaciones SET leido_en=COALESCE(leido_en,now()) WHERE secuencia=$1 AND usuario_id=$2 RETURNING secuencia',
      [body.id, auth.sesion.usuarioId],
    );
    return NextResponse.json(
      { ok: !!result.rowCount },
      { status: result.rowCount ? 200 : 404, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
