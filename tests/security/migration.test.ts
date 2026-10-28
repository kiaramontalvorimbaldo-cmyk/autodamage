import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const sql = readFileSync(
  new URL('../../supabase/migrations/004_sprint1_access_hardening.sql', import.meta.url),
  'utf8',
);
it('debería preparar privilegios de perfil limitados sin borrar datos', () => {
  expect(sql).toContain('REVOKE UPDATE ON public.usuarios FROM authenticated, anon');
  expect(sql).toContain('GRANT UPDATE(nombre_completo)');
  expect(sql).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM/i);
  expect(sql).not.toMatch(/GRANT UPDATE\(rol\)/i);
});
it('debería impedir que el asegurado escriba el estado del caso', () => {
  expect(sql).toContain('DROP POLICY IF EXISTS p_siniestros_asegurado');
  expect(sql).toContain("estado='PENDIENTE'");
  expect(sql).toContain('p_siniestros_insert_own');
  expect(sql).toContain('CREATE POLICY p_siniestros_update_perito');
});
it('debería usar auxiliares sin ciclos y fijar search_path', () => {
  expect(sql).toContain('public.es_taller_siniestro');
  expect(sql).toContain("SET search_path = ''");
  expect(sql).toContain('REVOKE ALL ON FUNCTION public.es_dueno_siniestro');
  expect(sql).toContain('idx_vehiculos_asegurado');
});
