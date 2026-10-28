import { it, expect } from 'vitest';
import { readDevelopmentUsers, developmentUsersPlan } from './development-users';
const valid = {
  DEV_ASEGURADO_PASSWORD: 'SoloPruebas123!',
  DEV_PERITO_PASSWORD: 'SoloPruebas123!',
  DEV_TALLER_1_PASSWORD: 'SoloPruebas123!',
  DEV_TALLER_2_PASSWORD: 'SoloPruebas123!',
  DEV_ADMIN_PASSWORD: 'SoloPruebas123!',
};
it('debería preparar cinco cuentas para los cuatro roles', () => {
  expect(readDevelopmentUsers(valid).map((u) => u.rol)).toEqual([
    'ASEGURADO',
    'PERITO',
    'TALLER',
    'TALLER',
    'ADMIN',
  ]);
});
it.each(Object.keys(valid))('debería rechazar el lote si falta %s', (key) => {
  expect(() => readDevelopmentUsers({ ...valid, [key]: undefined })).toThrow();
});
it('debería normalizar correos y rechazar duplicados entre roles', () => {
  expect(readDevelopmentUsers({ ...valid, DEV_ADMIN_EMAIL: ' ADMIN@EXAMPLE.TEST ' })[4].email).toBe(
    'admin@example.test',
  );
  expect(() =>
    readDevelopmentUsers({ ...valid, DEV_ADMIN_EMAIL: 'perito@autodamage.test' }),
  ).toThrow();
});
it('debería producir un plan sin contraseñas ni necesidad de secretos', () => {
  const plan = developmentUsersPlan(valid);
  expect(plan).toHaveLength(5);
  expect(JSON.stringify(plan)).not.toContain('SoloPruebas123!');
  expect(developmentUsersPlan({}).every((u) => !u.passwordConfigured)).toBe(true);
});
