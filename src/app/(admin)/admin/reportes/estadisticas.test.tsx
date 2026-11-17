import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const deps = vi.hoisted(() => ({
  auth: vi.fn().mockResolvedValue({ rol: 'ADMIN' }),
  query: vi.fn().mockResolvedValue({
    total: 2,
    dias: [['2026-11-17', 2]],
    estados: [['EN_REVISION', 2]],
    rutas: [['AMARILLA', 2]],
  }),
}));
vi.mock('@/lib/auth/require-portal-user', () => ({ requirePortalUser: deps.auth }));
vi.mock('@/infrastructure/repositories/report-queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/infrastructure/repositories/report-queries')>()),
  consultarEstadisticas: deps.query,
}));
import Page from './page';

it('muestra el resumen con el período solicitado', async () => {
  deps.query.mockClear();
  const html = renderToStaticMarkup(
    await Page({
      searchParams: Promise.resolve({ desde: '2026-11-17', hasta: '2026-11-17' }),
    }),
  );
  expect(deps.query).toHaveBeenCalledExactlyOnceWith({ desde: '2026-11-17', hasta: '2026-11-17' });
  expect(html).toContain('17/11/2026');
  expect(html).toContain('En revisión');
  expect(html).toContain('Amarilla');
});

it('rechaza fechas invertidas sin consultar datos', async () => {
  deps.query.mockClear();
  const html = renderToStaticMarkup(
    await Page({
      searchParams: Promise.resolve({ desde: '2026-11-18', hasta: '2026-11-17' }),
    }),
  );
  expect(deps.query).not.toHaveBeenCalled();
  expect(html).toContain('role="alert"');
});
