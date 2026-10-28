import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { SupabaseStorageService } from './supabase-storage';

vi.mock('@/infrastructure/supabase/admin-client', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient('https://supabase.test', 'clave-falsa', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { getAdminClient: () => client };
});
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('almacenamiento de evidencias', () => {
  it('debería solicitar el borrado exclusivamente de la ruta indicada', async () => {
    let llamadas = 0;
    server.use(
      http.delete('https://supabase.test/storage/v1/object/evidencias', async ({ request }) => {
        llamadas += 1;
        expect(await request.json()).toEqual({ prefixes: ['caso/nueva.jpg'] });
        return HttpResponse.json([]);
      }),
    );
    await new SupabaseStorageService().eliminar('caso/nueva.jpg');
    expect(llamadas).toBe(1);
  });
  it('debería propagar el fallo de limpieza', async () => {
    server.use(
      http.delete('https://supabase.test/storage/v1/object/evidencias', () =>
        HttpResponse.json({ message: 'detalle privado' }, { status: 400 }),
      ),
    );
    await expect(new SupabaseStorageService().eliminar('caso/nueva.jpg')).rejects.toMatchObject({
      code: 'STORAGE_ERROR',
      details: undefined,
    });
  });
  it('debería ocultar errores internos al fallar la subida', async () => {
    server.use(
      http.post('https://supabase.test/storage/v1/object/evidencias/caso/nueva.jpg', () =>
        HttpResponse.json({ message: 'detalle privado' }, { status: 400 }),
      ),
    );
    await expect(
      new SupabaseStorageService().subir({
        camino: 'caso/nueva.jpg',
        contenido: Buffer.from('jpeg'),
        tipoMime: 'image/jpeg',
      }),
    ).rejects.toMatchObject({ code: 'STORAGE_ERROR', details: undefined });
  });
});
