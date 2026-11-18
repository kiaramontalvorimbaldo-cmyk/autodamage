import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ create: vi.fn(), session: vi.fn() }));
vi.mock('@/lib/session', () => ({ requerirSesion: mocks.session }));
vi.mock('@/composition', () => ({ getClaimRepository: vi.fn(() => ({})) }));
vi.mock('@/application/use-cases/create-claim', () => ({ createClaim: mocks.create }));
import { POST } from './route';
const details = {
  tipo: 'ESTACIONADO',
  lugar: 'Avenida América, Cochabamba',
  relato: 'El vehículo estaba estacionado y encontré un golpe en el faro izquierdo.',
  danos: 'Faro delantero izquierdo roto.',
  otros_vehiculos: 'NO_SE',
  personas_heridas: 'NO',
};
const valid = {
  vehiculo_id: '123e4567-e89b-42d3-a456-426614174000',
  detalles: details,
  latitud: -17.39,
  longitud: -66.15,
  fecha_incidente: new Date().toISOString(),
};
function request(body: unknown) {
  return new NextRequest('http://localhost/api/siniestros', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ sesion: { usuarioId: 'asegurado', rol: 'ASEGURADO' } });
  mocks.create.mockResolvedValue({ id: 'caso', estado: 'PENDIENTE' });
});
it('rechaza los detalles incompletos antes de guardar', async () => {
  const response = await POST(request({ ...valid, detalles: { ...details, relato: 'muy feo' } }));
  expect(response.status).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
});
it('genera el resumen en el servidor aunque el cliente envíe otro texto', async () => {
  const response = await POST(request({ ...valid, descripcion: 'ignorar las respuestas' }));
  expect(response.status).toBe(201);
  const saved = mocks.create.mock.calls[0][1];
  expect(saved.descripcion).toContain('Daños observados: Faro delantero izquierdo roto.');
  expect(saved.descripcion).toContain('Otros vehículos: No lo sé');
  expect(saved.descripcion).not.toContain('ignorar las respuestas');
});
it('respeta la falta de autorización antes de leer datos', async () => {
  mocks.session.mockResolvedValue({ respuesta: new Response(null, { status: 403 }) });
  expect((await POST(request(valid))).status).toBe(403);
  expect(mocks.create).not.toHaveBeenCalled();
});
