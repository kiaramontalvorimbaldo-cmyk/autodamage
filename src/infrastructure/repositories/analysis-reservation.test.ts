import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { SupabaseClaimRepository } from './supabase-repositories';

vi.mock('@/infrastructure/supabase/admin-client', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient('https://supabase.test', 'clave-falsa-pruebas', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { getAdminClient: () => client };
});

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('reserva Supabase y comprobaciones de seguridad', () => {
  it('debería enviar estado e identidad como condiciones de una sola actualización', async () => {
    server.use(
      http.patch('https://supabase.test/rest/v1/siniestros', async ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('id')).toBe('eq.caso');
        expect(url.searchParams.get('analisis_estado')).toBe('eq.NO_INICIADO');
        expect(url.searchParams.get('estado')).toBe('eq.PENDIENTE');
        expect(await request.json()).toEqual({
          analisis_estado: 'EN_PROCESO',
          analisis_token: expect.stringMatching(/^[0-9a-f-]{36}$/),
          analisis_iniciado_en: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        });
        return HttpResponse.json([{ id: 'caso' }]);
      }),
    );
    expect(
      await new SupabaseClaimRepository().reservarAnalisis('caso', 'NO_INICIADO', 'PENDIENTE'),
    ).toBe(true);
  });

  it('debería informar conflicto cuando la actualización no afecta filas', async () => {
    server.use(http.patch('https://supabase.test/rest/v1/siniestros', () => HttpResponse.json([])));
    expect(
      await new SupabaseClaimRepository().reservarAnalisis('caso', 'NO_INICIADO', 'PENDIENTE'),
    ).toBe(false);
  });

  it('debería propagar una reserva fallida', async () => {
    server.use(
      http.patch('https://supabase.test/rest/v1/siniestros', () =>
        HttpResponse.json({ message: 'fallo' }, { status: 400 }),
      ),
    );
    await expect(
      new SupabaseClaimRepository().reservarAnalisis('caso', 'NO_INICIADO', 'PENDIENTE'),
    ).rejects.toThrow('No se pudo reservar');
  });

  it.each(['imagenes', 'cuota', 'duplicados'] as const)(
    'debería bloquear ante error al comprobar %s',
    async (comprobacion) => {
      server.use(
        http.all(
          'https://supabase.test/rest/v1/:table',
          () => new HttpResponse(null, { status: 400 }),
        ),
      );
      const repo = new SupabaseClaimRepository();
      const consulta =
        comprobacion === 'imagenes'
          ? repo.contarImagenes('caso')
          : comprobacion === 'cuota'
            ? repo.contarInspeccionesDigitalIaHoy(new Date())
            : repo.listarHashesDeOtrosSiniestros('caso');
      await expect(consulta).rejects.toThrow('No se pudo comprobar');
    },
  );
});
