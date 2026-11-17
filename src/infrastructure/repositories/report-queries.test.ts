import { afterEach, beforeAll, afterAll, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { consultarEstadisticas, filtroReportes, resumirSiniestros } from './report-queries';

vi.mock('@/infrastructure/supabase/admin-client', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  return {
    getAdminClient: () =>
      createClient('https://supabase.test', 'fake-key', {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
  };
});
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('agrupa por día boliviano y cuenta estados y rutas pendientes', () => {
  const datos = resumirSiniestros([
    { id: 'a', fecha_incidente: '2026-11-17T03:00:00Z', estado: 'PENDIENTE', ruta: null },
    { id: 'b', fecha_incidente: '2026-11-17T04:00:00Z', estado: 'FINALIZADO', ruta: 'VERDE' },
  ]);
  expect(datos.total).toBe(2);
  expect(datos.dias).toEqual([
    ['2026-11-16', 1],
    ['2026-11-17', 1],
  ]);
  expect(datos.rutas).toContainEqual(['SIN_CLASIFICAR', 1]);
});

it('valida fechas reales y el orden del período', () => {
  expect(filtroReportes.safeParse({ desde: '2026-02-30' }).success).toBe(false);
  expect(filtroReportes.safeParse({ desde: '2026-11-18', hasta: '2026-11-17' }).success).toBe(
    false,
  );
  expect(filtroReportes.safeParse({}).success).toBe(true);
});

it('incluye todos los lotes y aplica ambos límites del día en hora boliviana', async () => {
  let consultas = 0;
  server.use(
    http.get('https://supabase.test/rest/v1/siniestros', ({ request }) => {
      const url = new URL(request.url);
      expect(url.searchParams.getAll('fecha_incidente')).toEqual([
        'gte.2026-11-17T00:00:00-04:00',
        'lt.2026-11-18T00:00:00-04:00',
      ]);
      const offset = Number(url.searchParams.get('offset'));
      consultas++;
      return HttpResponse.json(
        Array.from({ length: offset === 0 ? 500 : 1 }, (_, i) => ({
          id: String(offset + i),
          fecha_incidente: '2026-11-17T12:00:00Z',
          estado: 'EN_REVISION',
          ruta: 'AMARILLA',
        })),
      );
    }),
  );
  const datos = await consultarEstadisticas({ desde: '2026-11-17', hasta: '2026-11-17' });
  expect(consultas).toBe(2);
  expect(datos.total).toBe(501);
  expect(datos.dias).toEqual([['2026-11-17', 501]]);
});
