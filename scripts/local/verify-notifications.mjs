import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import console from 'node:console';
import { configuration, databaseUrl } from './environment.mjs';
const db = new pg.Client({
  connectionString: databaseUrl(configuration()),
  connectionTimeoutMillis: 5000,
});
await db.connect();
try {
  await db.query('BEGIN');
  const owner = (
    await db.query("SELECT id FROM usuarios WHERE rol='ASEGURADO' ORDER BY creado_en LIMIT 1")
  ).rows[0];
  const workshop = (await db.query('SELECT id FROM talleres WHERE activo LIMIT 1')).rows[0];
  assert.ok(owner && workshop, 'Prepara las cuentas de demostración antes de verificar.');
  const vehicle = randomUUID(),
    claim = randomUUID(),
    order = randomUUID(),
    inspection = randomUUID();
  await db.query(
    'INSERT INTO vehiculos(id,asegurado_id,matricula,marca,modelo,numero_poliza) VALUES($1,$2,$3,$4,$5,$6)',
    [vehicle, owner.id, vehicle.slice(0, 20), 'Prueba', 'Prueba', vehicle],
  );
  await db.query(
    'INSERT INTO siniestros(id,asegurado_id,vehiculo_id,fecha_incidente,latitud,longitud) VALUES($1,$2,$3,now(),-17.39,-66.15)',
    [claim, owner.id, vehicle],
  );
  const titles = async () =>
    (
      await db.query('SELECT titulo FROM notificaciones WHERE siniestro_id=$1 ORDER BY secuencia', [
        claim,
      ])
    ).rows.map((row) => row.titulo);
  assert.equal((await titles()).length, 1);
  await db.query("UPDATE siniestros SET descripcion='prueba sin cambios de estado' WHERE id=$1", [
    claim,
  ]);
  assert.equal((await titles()).length, 1, 'No debe avisar por cualquier actualización.');
  await db.query("UPDATE siniestros SET estado='EN_REVISION' WHERE id=$1", [claim]);
  await db.query(
    'INSERT INTO inspecciones_periciales(id,siniestro_id,dictamen_final) VALUES($1,$2,$3)',
    [inspection, claim, 'AMPLIACION_REQUERIDA'],
  );
  const before = (await titles()).length;
  await db.query(
    "UPDATE inspecciones_periciales SET dictamen_final='AMPLIACION_REQUERIDA' WHERE id=$1",
    [inspection],
  );
  assert.equal((await titles()).length, before, 'No debe duplicar una ampliación sin cambios.');
  await db.query("UPDATE siniestros SET estado='APROBADO' WHERE id=$1", [claim]);
  await db.query(
    'INSERT INTO ordenes_trabajo(id,siniestro_id,taller_id,monto_autorizado) VALUES($1,$2,$3,150)',
    [order, claim, workshop.id],
  );
  await db.query("UPDATE ordenes_trabajo SET estado='RECIBIDO' WHERE id=$1", [order]);
  await db.query("UPDATE ordenes_trabajo SET estado='EN_REPARACION' WHERE id=$1", [order]);
  await db.query('UPDATE ordenes_trabajo SET fecha_estimada_entrega=CURRENT_DATE+1 WHERE id=$1', [
    order,
  ]);
  await db.query('UPDATE ordenes_trabajo SET fecha_estimada_entrega=NULL WHERE id=$1', [order]);
  await db.query("UPDATE siniestros SET estado='FINALIZADO' WHERE id=$1", [claim]);
  const messages = await titles();
  for (const text of [
    'revisión del perito',
    'información adicional',
    'aprobó',
    'orden de trabajo',
    'recibió',
    'inició la reparación',
    'Fecha estimada',
    'retiró la fecha',
    'finalizó',
  ])
    assert.ok(
      messages.some((title) => title.includes(text)),
      'Falta un aviso: ' + text,
    );
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS n FROM notificaciones WHERE siniestro_id=$1 AND usuario_id<>$2',
        [claim, owner.id],
      )
    ).rows[0].n,
    0,
  );
  console.log(
    'Avisos SQL verificados: estados, ampliación, taller, fecha y ausencia de duplicados. Datos de prueba revertidos.',
  );
} finally {
  await db.query('ROLLBACK');
  await db.end();
}
