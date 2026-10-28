import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminPanel } from './admin-panel';
const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiFetch: api.fetch,
}));
const datos = {
  usuarios: [{ id: 'u', nombre_completo: 'Taller Demo', email: 'taller@demo.com', rol: 'TALLER' }],
  peritos: [],
  talleres: [{ id: 't', usuario_id: 'u', nombre: 'El Freno', activo: true }],
  casos: [{ id: 'caso12345', estado: 'FAST_TRACK', ruta: 'VERDE', descripcion: 'Prueba' }],
  ordenes: [{ siniestro_id: 'caso12345', taller_id: 't', estado: 'EMITIDA' }],
  registros: [],
};
beforeEach(() => {
  api.fetch.mockReset();
  api.fetch.mockResolvedValue(datos);
});
describe('administración operativa', () => {
  it('debería mostrar el taller asignado a cada caso', async () => {
    render(<AdminPanel vista="casos" />);
    expect(await screen.findByText(/Taller: El Freno/)).toBeInTheDocument();
  });
  it('debería permitir desactivar personal mediante la API protegida', async () => {
    render(<AdminPanel vista="personal" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar' }));
    await waitFor(() =>
      expect(api.fetch).toHaveBeenCalledWith('/api/admin/personal/u', {
        method: 'PATCH',
        body: { activo: false },
      }),
    );
  });
  it('debería mostrar una auditoría vacía sin datos inventados', async () => {
    render(<AdminPanel vista="auditoria" />);
    expect(await screen.findByText('No hay eventos registrados.')).toBeInTheDocument();
  });
});
