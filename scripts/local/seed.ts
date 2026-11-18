import { readFileSync } from 'node:fs';
import process from 'node:process';
import { configuration, localEnvironment } from './environment.mjs';
import { passwordHash } from '../../src/infrastructure/local/auth';
import { localPool, transaction } from '../../src/infrastructure/local/database';

async function main() {
  Object.assign(process.env, localEnvironment(configuration()));
  const accounts = [
    ['asegurado@demo.com', 'Ana Asegurado Demo', 'ASEGURADO'],
    ['perito@demo.com', 'Carlos Perito Demo', 'PERITO'],
    ['taller@demo.com', 'Taller El Freno Demo', 'TALLER'],
    ['admin@demo.com', 'Dana Admin Demo', 'ADMIN'],
  ] as const;

  try {
    const hash = await passwordHash(process.env.DEMO_PASSWORD || 'Demo123456!');
    await transaction(async (db) => {
      for (const [email, nombre, rol] of accounts) {
        const { rows: previous } = await db.query(
          'SELECT id,rol FROM usuarios WHERE lower(email)=lower($1)',
          [email],
        );
        if (previous[0] && previous[0].rol !== rol)
          throw new Error('El rol existente difiere para ' + email);
        const id =
          previous[0]?.id ??
          (
            await db.query(
              'INSERT INTO usuarios(email,nombre_completo,rol) VALUES($1,$2,$3) RETURNING id',
              [email, nombre, rol],
            )
          ).rows[0].id;
        await db.query(
          'INSERT INTO credenciales(usuario_id,password_hash) VALUES($1,$2) ON CONFLICT DO NOTHING',
          [id, hash],
        );
        if (rol === 'PERITO')
          await db.query(
            "INSERT INTO peritos(usuario_id,numero_licencia) VALUES($1,'DEMO-LOCAL-001') ON CONFLICT(usuario_id) DO NOTHING",
            [id],
          );
        if (rol === 'TALLER')
          await db.query(
            'INSERT INTO talleres(usuario_id,nombre) VALUES($1,$2) ON CONFLICT(usuario_id) DO NOTHING',
            [id, nombre],
          );
        console.log(email, rol);
      }
      const baremo = JSON.parse(readFileSync('supabase/seed/baremo.json', 'utf8'));
      for (const pieza of baremo)
        await db.query(
          `
      INSERT INTO baremo_mock(codigo_pieza,pieza_nombre,marca_vehiculo,costo_repuesto_base,horas_mano_obra,costo_hora_mo)
      VALUES($1,$2,'GENERICO',$3,$4,30) ON CONFLICT(codigo_pieza) DO NOTHING`,
          [
            pieza.codigo_pieza,
            pieza.pieza_nombre,
            pieza.costo_repuesto_base,
            pieza.horas_mano_obra,
          ],
        );
    });
    console.log('Cuentas y baremo locales preparados. Las contraseñas existentes se conservaron.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'No se pudo preparar la demostración.');
    process.exitCode = 1;
  } finally {
    await localPool().end();
  }
}
void main();
