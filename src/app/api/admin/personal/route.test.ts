import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { PATCH } from './[id]/route';
import { GET } from '../resumen/route';
const deps = vi.hoisted(() => ({
  auth: vi.fn(),
  crear: vi.fn(),
  activo: vi.fn(),
  consulta: vi.fn(),
}));
vi.mock('@/lib/session', () => ({ requerirSesion: deps.auth }));
vi.mock('@/composition', () => ({
  getStaffRepository: () => ({ crearPersonal: deps.crear, cambiarActivoPersonal: deps.activo }),
  consultarAdministracion: deps.consulta,
}));
beforeEach(() => {
  vi.clearAllMocks();
  deps.auth.mockResolvedValue({ sesion: { usuarioId: 'admin', rol: 'ADMIN' } });
});
describe('administración con autorización y repositorio conectado', () => {
  it('debería crear personal mediante el repositorio y no almacenar la contraseña en caché', async () => {
    deps.crear.mockResolvedValue({
      usuarioId: 'nuevo',
      rol: 'PERITO',
      passwordTemporal: 'temporal-solo-prueba',
    });
    const response = await POST(
      new NextRequest('http://localhost/api/admin/personal', {
        method: 'POST',
        body: JSON.stringify({
          tipo: 'PERITO',
          nombre: 'Perito Prueba',
          email: 'prueba@example.com',
          numero_licencia: 'LIC123',
        }),
      }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(deps.crear).toHaveBeenCalledWith(expect.objectContaining({ numeroLicencia: 'LIC123' }));
  });
  it('debería conectar el cambio de estado al repositorio', async () => {
    deps.activo.mockResolvedValue(undefined);
    const response = await PATCH(
      new NextRequest('http://localhost/api/admin/personal/id', {
        method: 'PATCH',
        body: JSON.stringify({ activo: false }),
      }),
      { params: Promise.resolve({ id: 'usuario' }) },
    );
    expect(response.status).toBe(200);
    expect(deps.activo).toHaveBeenCalledWith('usuario', false);
  });
  it('debería impedir leer el panel sin permiso antes de consultar datos', async () => {
    deps.auth.mockResolvedValue({
      respuesta: Response.json({ error: { code: 'SIN_PERMISO' } }, { status: 403 }),
    });
    const response = await GET(new NextRequest('http://localhost/api/admin/resumen'));
    expect(response.status).toBe(403);
    expect(deps.consulta).not.toHaveBeenCalled();
  });
});
