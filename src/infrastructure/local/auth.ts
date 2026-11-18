import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies, headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { localPool, transaction } from './database';
import { AppError } from '@/lib/errors';
import { portalPorRol } from '@/lib/portal-routes';
import type { Rol } from '@/domain/types';

const derive = promisify(scrypt);
export const SESSION_COOKIE = 'autodamage_session';
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await derive(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}
async function passwordMatches(password: string, encoded: string) {
  const [algorithm, salt, digest] = encoded.split(':');
  if (algorithm !== 'scrypt' || !salt || !/^[a-f0-9]{128}$/.test(digest ?? '')) return false;
  const actual = (await derive(password, salt, 64)) as Buffer;
  return timingSafeEqual(actual, Buffer.from(digest, 'hex'));
}
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function tokenFrom(request: NextRequest) {
  return (
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.cookies.get(SESSION_COOKIE)?.value
  );
}

export async function localUser(token?: string) {
  if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token))
    throw new AppError('NO_AUTENTICADO', 401, 'Inicia sesión para continuar.');
  const { rows } = await localPool().query<{ usuarioId: string; nombre: string; rol: Rol }>(
    `
    SELECT u.id AS "usuarioId", u.nombre_completo AS nombre, u.rol FROM sesiones s
    JOIN usuarios u ON u.id=s.usuario_id
    WHERE s.token_hash=$1 AND s.expira_en>now() AND u.activo
      AND (u.rol<>'PERITO' OR EXISTS(SELECT 1 FROM peritos p WHERE p.usuario_id=u.id AND p.estado<>'INACTIVO'))
      AND (u.rol<>'TALLER' OR EXISTS(SELECT 1 FROM talleres t WHERE t.usuario_id=u.id AND t.activo))`,
    [tokenHash(token)],
  );
  if (!rows[0])
    throw new AppError('NO_AUTENTICADO', 401, 'La sesión venció o la cuenta está inactiva.');
  return rows[0];
}

export async function currentLocalUser() {
  const h = await headers();
  const c = await cookies();
  return localUser(
    h.get('authorization')?.replace(/^Bearer\s+/i, '') || c.get(SESSION_COOKIE)?.value,
  );
}

function sessionResponse(token: string, usuarioId: string, rol: Rol) {
  const response = NextResponse.json({
    ok: true,
    userId: usuarioId,
    destino: portalPorRol(rol),
    token,
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 8 * 60 * 60,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function loginLocal(email: string, password: string, soloAsegurado = false) {
  const correoHash = tokenHash(email.trim().toLowerCase());
  const attempt = await localPool().query<{ intentos: number }>(
    `
    INSERT INTO intentos_acceso(correo_hash) VALUES($1)
    ON CONFLICT(correo_hash) DO UPDATE SET
      intentos=CASE WHEN intentos_acceso.ventana < now()-interval '15 minutes' THEN 1 ELSE intentos_acceso.intentos+1 END,
      ventana=CASE WHEN intentos_acceso.ventana < now()-interval '15 minutes' THEN now() ELSE intentos_acceso.ventana END
    RETURNING intentos`,
    [correoHash],
  );
  if (attempt.rows[0].intentos > 10)
    throw new AppError(
      'DEMASIADOS_INTENTOS',
      429,
      'Espera 15 minutos antes de volver a intentarlo.',
    );
  const { rows } = await localPool().query<{ id: string; password_hash: string; rol: Rol }>(
    `
    SELECT u.id, u.rol, c.password_hash FROM usuarios u JOIN credenciales c ON c.usuario_id=u.id WHERE lower(u.email)=lower($1)`,
    [email.trim()],
  );
  const encoded =
    rows[0]?.password_hash ?? 'scrypt:00000000000000000000000000000000:' + '0'.repeat(128);
  if (!(await passwordMatches(password, encoded)) || !rows[0])
    throw new AppError('CREDENCIALES_INVALIDAS', 401, 'Revisa tu correo y contraseña.');
  if (soloAsegurado && rows[0].rol !== 'ASEGURADO')
    throw new AppError('ROL_NO_ADMITIDO', 403, 'Esta app es exclusiva del asegurado.');
  const token = randomBytes(32).toString('base64url');
  await localPool().query(
    "INSERT INTO sesiones(token_hash,usuario_id,expira_en) VALUES($1,$2,now()+interval '8 hours')",
    [tokenHash(token), rows[0].id],
  );
  try {
    const user = await localUser(token);
    await localPool().query('DELETE FROM intentos_acceso WHERE correo_hash=$1', [correoHash]);
    return sessionResponse(token, user.usuarioId, user.rol);
  } catch (error) {
    await localPool().query('DELETE FROM sesiones WHERE token_hash=$1', [tokenHash(token)]);
    throw error;
  }
}

export async function registerLocal(email: string, password: string, nombre: string) {
  const hash = await passwordHash(password);
  try {
    await transaction(async (db) => {
      const { rows } = await db.query(
        'INSERT INTO usuarios(email,nombre_completo,rol) VALUES(lower($1),$2,$3) RETURNING id',
        [email.trim(), nombre, 'ASEGURADO'],
      );
      await db.query('INSERT INTO credenciales(usuario_id,password_hash) VALUES($1,$2)', [
        rows[0].id,
        hash,
      ]);
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505')
      throw new AppError('CORREO_DUPLICADO', 409, 'Ya existe una cuenta con ese correo.');
    throw error;
  }
  return loginLocal(email, password);
}

export async function logoutLocal(request: NextRequest) {
  const token = tokenFrom(request);
  if (token)
    await localPool().query('DELETE FROM sesiones WHERE token_hash=$1', [tokenHash(token)]);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0,
  });
  return response;
}
