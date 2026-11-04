import { it, expect, vi } from 'vitest';
const query = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth/require-portal-user', () => ({
  requirePortalUser: vi.fn().mockRejectedValue(new Error('Sin autorización')),
}));
vi.mock('@/infrastructure/repositories/admin-queries', () => ({ consultarAdministracion: query }));
import Page from './page';
it('debería impedir consultar datos de reportes cuando falla la autorización de administrador', async () => {
  await expect(Page()).rejects.toThrow('Sin autorización');
  expect(query).not.toHaveBeenCalled();
});
