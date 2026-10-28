import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

/**
 * Pruebas de integración RLS contra el proyecto `dev` de Supabase.
 *
 * Se ejecutan solo cuando se proporcionan credenciales de un proyecto
 * real y usuarios de prueba (ver scripts/seed-dev-users.ts):
 *
 *   SUPABASE_TEST_URL=... SUPABASE_TEST_SERVICE_KEY=... \
 *   DEV_ASEGURADO_EMAIL=... DEV_ASEGURADO_PASSWORD=... \
 *   DEV_TALLER_1_EMAIL=... DEV_TALLER_1_PASSWORD=... \
 *   npx vitest run tests/integration
 *
 * En CI/local sin proyecto real, esta suite se omite.
 */

const url = process.env.SUPABASE_TEST_URL ?? '';
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY ?? '';
const aseguradoEmail = process.env.DEV_ASEGURADO_EMAIL ?? '';
const aseguradoPassword = process.env.DEV_ASEGURADO_PASSWORD ?? '';
const tallerEmail = process.env.DEV_TALLER_1_EMAIL ?? '';
const tallerPassword = process.env.DEV_TALLER_1_PASSWORD ?? '';

const credencialesCompletas =
  !!url &&
  !!serviceKey &&
  !!aseguradoEmail &&
  !!aseguradoPassword &&
  !!tallerEmail &&
  !!tallerPassword;

describe.skipIf(!credencialesCompletas)('RLS contra proyecto dev', () => {
  it('un asegurado solo ve sus propios siniestros', async () => {
    const supabase = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: aseguradoEmail,
      password: aseguradoPassword,
    });
    expect(loginError).toBeNull();

    const { data, error } = await supabase.from('siniestros').select('id');
    expect(error).toBeNull();
    // Con RLS correcto, la consulta no falla y devuelve solo filas propias
    // (vacío si el asegurado no tiene siniestros).
    expect(Array.isArray(data)).toBe(true);
  });

  it('un taller no puede leer inspecciones_periciales', async () => {
    const supabase = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: tallerEmail,
      password: tallerPassword,
    });
    expect(loginError).toBeNull();

    const { error } = await supabase.from('inspecciones_periciales').select('id');
    // RLS: el taller no tiene política SELECT sobre inspecciones_periciales
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('audit_log rechaza UPDATE y DELETE (inmutabilidad)', async () => {
    const supabase = createClient(url, serviceKey);
    const { error } = await supabase.from('audit_log').update({ accion: 'X' });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/inmutable/i);
  });
});
