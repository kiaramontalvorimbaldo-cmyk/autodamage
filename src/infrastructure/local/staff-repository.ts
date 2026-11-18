import { randomBytes } from 'node:crypto';
import type {
  StaffRepository,
  CrearPersonalDatos,
  StaffCreado,
} from '@/application/ports/staff-repository';
import { transaction } from './database';
import { passwordHash } from './auth';
import { AppError } from '@/lib/errors';

export class LocalStaffRepository implements StaffRepository {
  async crearPersonal(input: CrearPersonalDatos): Promise<StaffCreado> {
    const passwordTemporal = 'Aa1!' + randomBytes(18).toString('base64url');
    const hash = await passwordHash(passwordTemporal);
    try {
      return await transaction(async (db) => {
        const { rows } = await db.query(
          'INSERT INTO usuarios(email,nombre_completo,rol) VALUES(lower($1),$2,$3) RETURNING id',
          [input.email, input.nombre, input.tipo],
        );
        const id = rows[0].id;
        await db.query('INSERT INTO credenciales(usuario_id,password_hash) VALUES($1,$2)', [
          id,
          hash,
        ]);
        if (input.tipo === 'PERITO')
          await db.query('INSERT INTO peritos(usuario_id,numero_licencia) VALUES($1,$2)', [
            id,
            input.numeroLicencia,
          ]);
        else
          await db.query(
            'INSERT INTO talleres(usuario_id,nombre,direccion,telefono) VALUES($1,$2,$3,$4)',
            [id, input.nombreTaller, input.direccion ?? null, input.telefono ?? null],
          );
        return { usuarioId: id, rol: input.tipo, passwordTemporal };
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw new AppError('CORREO_DUPLICADO', 409, 'Ya existe ese correo o número de licencia.');
      throw error;
    }
  }
  async cambiarActivoPersonal(usuarioId: string, activo: boolean) {
    await transaction(async (db) => {
      const { rows } = await db.query('SELECT rol FROM usuarios WHERE id=$1 FOR UPDATE', [
        usuarioId,
      ]);
      if (!rows[0] || !['PERITO', 'TALLER'].includes(rows[0].rol))
        throw new AppError('SIN_PERMISO', 403, 'Selecciona una cuenta de personal.');
      await db.query('UPDATE usuarios SET activo=$2 WHERE id=$1', [usuarioId, activo]);
      if (rows[0].rol === 'PERITO')
        await db.query('UPDATE peritos SET estado=$2 WHERE usuario_id=$1', [
          usuarioId,
          activo ? 'ACTIVO' : 'INACTIVO',
        ]);
      else await db.query('UPDATE talleres SET activo=$2 WHERE usuario_id=$1', [usuarioId, activo]);
      if (!activo) await db.query('DELETE FROM sesiones WHERE usuario_id=$1', [usuarioId]);
    });
  }
}
