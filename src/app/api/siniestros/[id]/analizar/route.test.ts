import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { InMemoryClaimRepository } from '@/infrastructure/repositories/in-memory-claim-repository';
import { POST } from './route';

const mocks = vi.hoisted(() => ({ sesion: vi.fn(), repo: vi.fn(), after: vi.fn() }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: mocks.after,
}));
vi.mock('@/lib/session', () => ({ requerirSesion: mocks.sesion }));
vi.mock('@/composition', () => ({
  getClaimRepository: mocks.repo,
  getAiProvider: vi.fn(),
  getAuditRepository: vi.fn(),
  getBaremoRepository: vi.fn(),
  getRateLimiter: vi.fn(),
  getStorageService: vi.fn(),
  getWorkOrderRepository: vi.fn(),
}));

async function preparar(conImagen = true) {
  const repo = new InMemoryClaimRepository();
  const s = await repo.crearSiniestro({
    aseguradoId: 'dueno',
    vehiculoId: 'vehiculo',
    descripcion: null,
    latitud: 0,
    longitud: 0,
    fechaIncidente: '2026-10-21T00:00:00Z',
    fechaRegistro: '2026-10-21T00:00:00Z',
  });
  if (conImagen)
    await repo.crearImagen({
      id: 'img',
      siniestroId: s.id,
      storagePath: 'img.jpg',
      hashPerceptual: 'aaaaaaaaaaaaaaaa',
      capturadaEn: '2026-10-21T00:00:00Z',
      latitud: null,
      longitud: null,
      precisionGpsM: null,
      userAgent: null,
      orden: 0,
      rostrosDifuminados: true,
    });
  if (conImagen) {
    const [foto] = await repo.listarImagenes(s.id);
    for(let n=1;n<3;n++) await repo.crearImagen({...foto,id:`img-${n}`,orden:n});
  }
  mocks.repo.mockReturnValue(repo);
  return { repo, params: Promise.resolve({ id: s.id }) };
}
const request = () =>
  new NextRequest('http://localhost/api/siniestros/caso/analizar', { method: 'POST' });

describe('POST analizar', () => {
  it.each([1,2])('debería impedir iniciar IA con solo %s fotos sin programar trabajo',async cantidad=>{
    const ctx=await preparar();vi.spyOn(ctx.repo,'contarImagenes').mockResolvedValue(cantidad);
    const respuesta=await POST(request(),ctx);expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toMatchObject({error:{code:'FOTOS_INSUFICIENTES'}});
    expect(mocks.after).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sesion.mockResolvedValue({ sesion: { usuarioId: 'dueno', rol: 'ASEGURADO' } });
  });
  it('debería responder 202 y programar un único trabajo ante dos solicitudes', async () => {
    const ctx = await preparar();
    const respuestas = await Promise.all([POST(request(), ctx), POST(request(), ctx)]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([202, 409]);
    expect(mocks.after).toHaveBeenCalledOnce();
    expect(mocks.sesion).toHaveBeenCalledWith(expect.anything(), ['ASEGURADO']);
  });
  it('debería impedir el trabajo de un asegurado ajeno', async () => {
    const ctx = await preparar();
    mocks.sesion.mockResolvedValue({ sesion: { usuarioId: 'otro', rol: 'ASEGURADO' } });
    expect((await POST(request(), ctx)).status).toBe(403);
    expect(mocks.after).not.toHaveBeenCalled();
  });
  it('debería exigir imágenes antes de reservar', async () => {
    const ctx = await preparar(false);
    expect((await POST(request(), ctx)).status).toBe(409);
    expect(mocks.after).not.toHaveBeenCalled();
  });
  it('debería conservar el rechazo de autenticación sin consultar el repositorio', async () => {
    mocks.sesion.mockResolvedValue({
      respuesta: Response.json({ error: { code: 'NO_AUTENTICADO' } }, { status: 401 }),
    });
    expect((await POST(request(), { params: Promise.resolve({ id: 'caso' }) })).status).toBe(401);
    expect(mocks.repo).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });
});
