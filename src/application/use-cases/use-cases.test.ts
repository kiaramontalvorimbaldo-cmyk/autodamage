import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { uploadImage } from './upload-image';
import { createClaim } from './create-claim';
import { getClaim } from './get-claim';
import { InMemoryClaimRepository } from '@/infrastructure/repositories/in-memory-claim-repository';
import { InMemoryStorageService } from '@/infrastructure/storage/in-memory-storage';
import { SharpImageService } from '@/infrastructure/image/image-service';
import { clockFijo } from '@/application/ports/clock';
import { MAX_BYTES_IMAGEN } from '@/domain/config';
import { jpegConExif } from '../../../tests/helpers/exif-jpeg';

const USUARIO = '00000000-0000-0000-0000-000000000001';
const OTRO_USUARIO = '00000000-0000-0000-0000-000000000002';
const AHORA = new Date('2026-01-15T12:00:00Z');
const imagenes = new SharpImageService();

/** JPEG real (sin EXIF) para las subidas que llegan al cálculo de dHash. */
const JPG_REAL: Buffer = await sharp(Buffer.from(new Array(64 * 64 * 3).fill(128)), {
  raw: { width: 64, height: 64, channels: 3 },
})
  .jpeg()
  .toBuffer();

async function crearSiniestro(repositorio: InMemoryClaimRepository, aseguradoId = USUARIO) {
  const vehiculo = await repositorio.crearVehiculo({
    aseguradoId,
    matricula: 'ABC-123',
    marca: 'Toyota',
    modelo: 'Corolla',
    numeroPoliza: 'POL-1',
  });
  return createClaim(
    { repositorio, reloj: clockFijo(AHORA) },
    {
      aseguradoId,
      vehiculoId: vehiculo.id,
      descripcion: null,
      latitud: 19.4326,
      longitud: -99.1332,
      fechaIncidente: '2026-01-15T11:50:00Z',
    },
  );
}

function entradaImagen(siniestroId: string, archivo: Buffer, aseguradoId = USUARIO) {
  return {
    siniestroId,
    aseguradoId,
    archivo,
    tipoMime: 'image/jpeg',
    capturadaEn: '2026-01-15T11:55:00Z',
    latitud: 19.4326,
    longitud: -99.1332,
    precisionGpsM: 10,
    orden: 0,
    rostrosDifuminados: true,
    userAgent: 'test-agent',
  };
}

describe('createClaim', () => {
  it('crea un siniestro en PENDIENTE con fecha de registro del reloj', async () => {
    const repositorio = new InMemoryClaimRepository();

    const siniestro = await crearSiniestro(repositorio);

    expect(siniestro.estado).toBe('PENDIENTE');
    expect(siniestro.analisisEstado).toBe('NO_INICIADO');
    expect(siniestro.fechaRegistro).toBe(AHORA.toISOString());
  });

  it('rechaza vehículo que no pertenece al asegurado', async () => {
    const repositorio = new InMemoryClaimRepository();
    await repositorio.crearVehiculo({
      aseguradoId: OTRO_USUARIO,
      matricula: 'ABC-123',
      marca: 'Toyota',
      modelo: 'Corolla',
      numeroPoliza: 'POL-1',
    });
    const vehiculo = await repositorio.listarVehiculosPorAsegurado(OTRO_USUARIO);

    await expect(
      createClaim(
        { repositorio, reloj: clockFijo(AHORA) },
        {
          aseguradoId: USUARIO,
          vehiculoId: vehiculo[0].id,
          descripcion: null,
          latitud: 0,
          longitud: 0,
          fechaIncidente: '2026-01-15T11:50:00Z',
        },
      ),
    ).rejects.toMatchObject({ code: 'VEHICULO_AJENO', status: 403 });
  });

  it('rechaza vehículo inexistente', async () => {
    const repositorio = new InMemoryClaimRepository();
    await expect(
      createClaim(
        { repositorio, reloj: clockFijo(AHORA) },
        {
          aseguradoId: USUARIO,
          vehiculoId: '00000000-0000-0000-0000-000000000009',
          descripcion: null,
          latitud: 0,
          longitud: 0,
          fechaIncidente: '2026-01-15T11:50:00Z',
        },
      ),
    ).rejects.toMatchObject({ code: 'VEHICULO_NO_ENCONTRADO', status: 404 });
  });
});

describe('uploadImage', () => {
  it('debería limpiar solo el archivo recién subido si falla el registro', async () => {
    const repositorio = new InMemoryClaimRepository();
    const almacen = new InMemoryStorageService();
    const siniestro = await crearSiniestro(repositorio);
    await almacen.subir({ camino: 'existente.jpg', contenido: JPG_REAL, tipoMime: 'image/jpeg' });
    const subir = vi.spyOn(almacen, 'subir');
    vi.spyOn(repositorio, 'crearImagen').mockRejectedValue(new Error('fallo de registro'));
    await expect(
      uploadImage({ repositorio, almacen, imagenes }, entradaImagen(siniestro.id, JPG_REAL)),
    ).rejects.toThrow('fallo de registro');
    expect(almacen.contenido(subir.mock.calls[0][0].camino)).toBeUndefined();
    expect(almacen.contenido('existente.jpg')).toEqual(JPG_REAL);
  });

  it('debería informar una limpieza fallida sin filtrar detalles internos', async () => {
    const repositorio = new InMemoryClaimRepository();
    const almacen = new InMemoryStorageService();
    const siniestro = await crearSiniestro(repositorio);
    vi.spyOn(repositorio, 'crearImagen').mockRejectedValue(new Error('secreto BD'));
    vi.spyOn(almacen, 'eliminar').mockRejectedValue(new Error('secreto storage'));
    await expect(
      uploadImage({ repositorio, almacen, imagenes }, entradaImagen(siniestro.id, JPG_REAL)),
    ).rejects.toMatchObject({
      code: 'EVIDENCIA_LIMPIEZA_PENDIENTE',
      status: 502,
      details: undefined,
    });
  });
  it('sube una imagen válida: la guarda en storage y registra hash dHash', async () => {
    const repositorio = new InMemoryClaimRepository();
    const almacen = new InMemoryStorageService();
    const siniestro = await crearSiniestro(repositorio);

    const imagen = await uploadImage(
      { repositorio, almacen, imagenes },
      entradaImagen(siniestro.id, JPG_REAL),
    );

    expect(imagen.siniestroId).toBe(siniestro.id);
    expect(imagen.rostrosDifuminados).toBe(true);
    expect(imagen.userAgent).toBe('test-agent');
    expect(imagen.hashPerceptual).toMatch(/^[0-9A-F]{16}$/);
    expect(imagen.storagePath).toBe(`${siniestro.id}/${imagen.id}.jpg`);
    expect(almacen.contenido(imagen.storagePath)).toBeInstanceOf(Buffer);
  });

  it('rechaza imagen con EXIF de cámara (ARCHIVO_NO_EN_VIVO)', async () => {
    const repositorio = new InMemoryClaimRepository();
    const almacen = new InMemoryStorageService();
    const siniestro = await crearSiniestro(repositorio);

    await expect(
      uploadImage({ repositorio, almacen, imagenes }, entradaImagen(siniestro.id, jpegConExif())),
    ).rejects.toMatchObject({ code: 'ARCHIVO_NO_EN_VIVO', status: 422 });
  });

  it('rechaza MIME distinto de JPEG', async () => {
    const repositorio = new InMemoryClaimRepository();
    const almacen = new InMemoryStorageService();
    const siniestro = await crearSiniestro(repositorio);

    await expect(
      uploadImage(
        { repositorio, almacen, imagenes },
        { ...entradaImagen(siniestro.id, JPG_REAL), tipoMime: 'image/png' },
      ),
    ).rejects.toMatchObject({ code: 'TIPO_ARCHIVO_INVALIDO', status: 415 });
  });

  it('rechaza imagen mayor a 1.5 MB', async () => {
    const repositorio = new InMemoryClaimRepository();
    const almacen = new InMemoryStorageService();
    const siniestro = await crearSiniestro(repositorio);

    await expect(
      uploadImage(
        { repositorio, almacen, imagenes },
        entradaImagen(siniestro.id, Buffer.alloc(MAX_BYTES_IMAGEN + 1)),
      ),
    ).rejects.toMatchObject({ code: 'ARCHIVO_DEMASIADO_GRANDE', status: 413 });
  });

  it('rechaza más de 5 imágenes por siniestro', async () => {
    const repositorio = new InMemoryClaimRepository();
    const almacen = new InMemoryStorageService();
    const siniestro = await crearSiniestro(repositorio);

    for (let i = 0; i < 5; i += 1) {
      await uploadImage({ repositorio, almacen, imagenes }, entradaImagen(siniestro.id, JPG_REAL));
    }

    await expect(
      uploadImage({ repositorio, almacen, imagenes }, entradaImagen(siniestro.id, JPG_REAL)),
    ).rejects.toMatchObject({ code: 'LIMITE_IMAGENES', status: 409 });
  });

  it('rechaza imágenes de un siniestro ajeno', async () => {
    const repositorio = new InMemoryClaimRepository();
    const almacen = new InMemoryStorageService();
    const siniestro = await crearSiniestro(repositorio);

    await expect(
      uploadImage(
        { repositorio, almacen, imagenes },
        entradaImagen(siniestro.id, JPG_REAL, OTRO_USUARIO),
      ),
    ).rejects.toMatchObject({ code: 'SINIESTRO_AJENO', status: 403 });
  });

  it('rechaza subir a un siniestro inexistente', async () => {
    const repositorio = new InMemoryClaimRepository();
    const almacen = new InMemoryStorageService();

    await expect(
      uploadImage(
        { repositorio, almacen, imagenes },
        entradaImagen('00000000-0000-0000-0000-000000000099', JPG_REAL),
      ),
    ).rejects.toMatchObject({ code: 'SINIESTRO_NO_ENCONTRADO', status: 404 });
  });

  it('rechaza subir a un siniestro ya analizado', async () => {
    const repositorio = new InMemoryClaimRepository();
    const almacen = new InMemoryStorageService();
    const siniestro = await crearSiniestro(repositorio);
    await repositorio.actualizarSiniestro(siniestro.id, { estado: 'FAST_TRACK' });

    await expect(
      uploadImage({ repositorio, almacen, imagenes }, entradaImagen(siniestro.id, JPG_REAL)),
    ).rejects.toMatchObject({ code: 'ESTADO_INVALIDO', status: 409 });
  });
});

describe('getClaim', () => {
  it('devuelve el detalle con URL firmada para el dueño', async () => {
    const repositorio = new InMemoryClaimRepository();
    const almacen = new InMemoryStorageService();
    const siniestro = await crearSiniestro(repositorio);
    await uploadImage({ repositorio, almacen, imagenes }, entradaImagen(siniestro.id, JPG_REAL));

    const detalle = await getClaim({ repositorio, almacen }, siniestro.id, USUARIO, 'ASEGURADO');

    expect(detalle.siniestro?.id).toBe(siniestro.id);
    expect(detalle.imagenes).toHaveLength(1);
    expect(detalle.imagenes[0].url).toContain('firma=mock');
    expect(detalle.inspeccion).toBeNull();
    expect(detalle.evaluaciones).toEqual([]);
  });

  it('un ASEGURADO ajeno no puede ver el siniestro', async () => {
    const repositorio = new InMemoryClaimRepository();
    const almacen = new InMemoryStorageService();
    const siniestro = await crearSiniestro(repositorio);

    await expect(
      getClaim({ repositorio, almacen }, siniestro.id, OTRO_USUARIO, 'ASEGURADO'),
    ).rejects.toMatchObject({ code: 'SINIESTRO_AJENO', status: 403 });
  });

  it('PERITO y ADMIN pueden ver cualquier siniestro', async () => {
    const repositorio = new InMemoryClaimRepository();
    const almacen = new InMemoryStorageService();
    const siniestro = await crearSiniestro(repositorio);

    for (const rol of ['PERITO', 'ADMIN'] as const) {
      const detalle = await getClaim({ repositorio, almacen }, siniestro.id, USUARIO, rol);
      expect(detalle.siniestro?.id).toBe(siniestro.id);
    }
  });

  it('rechaza siniestro inexistente', async () => {
    const repositorio = new InMemoryClaimRepository();
    const almacen = new InMemoryStorageService();

    await expect(
      getClaim({ repositorio, almacen }, 'no-existe', USUARIO, 'ASEGURADO'),
    ).rejects.toMatchObject({ code: 'SINIESTRO_NO_ENCONTRADO', status: 404 });
  });
});
