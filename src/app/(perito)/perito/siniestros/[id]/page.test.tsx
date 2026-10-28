// @vitest-environment jsdom
import { Suspense } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import Page from './page';
import { apiFetch, ApiError } from '@/lib/api-client';

const state = vi.hoisted(() => ({ estado: 'FAST_TRACK', analisisEstado: 'COMPLETADO' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/dynamic', () => ({ default: () => () => <div>Mapa de prueba</div> }));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiFetch: vi.fn(async (url: string) =>
    url.endsWith('/auditoria')
      ? { registros: [] }
      : {
          siniestro: {
            id: 'caso',
            estado: state.estado,
            analisisEstado: state.analisisEstado,
            ruta: 'VERDE',
            latitud: 0,
            longitud: 0,
            etiquetas: [],
          },
          imagenes: [
            { id: 'foto1', url: '/foto1.jpg', latitud: null, longitud: null },
            { id: 'foto2', url: '/foto2.jpg', latitud: null, longitud: null },
          ],
          inspeccion: {
            modeloIa: 'mock-local',
            versionPrompt: 'v1',
            nivelSeveridad: 'LEVE',
            confianzaGlobal: 0.93,
            verdictFraude: 'SIN_RIESGO',
            costoTotalEstimado: 150,
            indicadoresFraude: [],
          },
          evaluaciones: [
            {
              id: 'ev',
              codigoPieza: 'FARO_DEL_IZQ',
              accionRequerida: 'SUSTITUIR',
              costoPiezaEstimado: 150,
              confianza: 0.9,
              imagenId: 'foto2',
              bbox: [0, 0, 500, 500],
              aprobadoPorPerito: true,
              observacionPieza: null,
            },
          ],
        },
  ),
}));
async function mostrar() {
  const params = Promise.resolve({ id: 'caso' });
  await act(async () => {
    render(
      <Suspense fallback={<p>Cargando</p>}>
        <Page params={params} />
      </Suspense>,
    );
  });
  await screen.findByRole('heading', { name: 'Siniestro caso' });
}
beforeEach(() => {
  state.estado = 'FAST_TRACK';
  state.analisisEstado = 'COMPLETADO';
});

it('debería mostrar vía rápida en consulta sin editar ni ofrecer dictamen', async () => {
  await mostrar();
  expect(screen.queryByRole('button', { name: 'Registrar dictamen' })).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Acción para FARO_DEL_IZQ' })).toBeDisabled();
  expect(screen.getByText('Análisis simulado de prueba.')).toBeInTheDocument();
});
it('debería permitir revisión y seleccionar la foto con sus propias cajas', async () => {
  state.estado = 'EN_REVISION';
  await mostrar();
  expect(screen.getByRole('button', { name: 'Registrar dictamen' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Acción para FARO_DEL_IZQ' })).not.toBeDisabled();
  const viewer = screen.getByTestId('damage-viewer');
  expect(viewer.querySelectorAll('rect')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Ver foto 2' }));
  expect(viewer.querySelector('img')).toHaveAttribute('src', '/foto2.jpg');
  expect(viewer.querySelectorAll('rect')).toHaveLength(1);
});
it('debería bloquear el dictamen durante el reanálisis', async () => {
  state.estado = 'EN_REVISION';
  state.analisisEstado = 'EN_PROCESO';
  await mostrar();
  expect(screen.queryByRole('button', { name: 'Registrar dictamen' })).not.toBeInTheDocument();
});

it('debería permitir reintentar un análisis fallido pendiente sin ofrecer dictamen', async () => {
  state.estado = 'PENDIENTE';
  state.analisisEstado = 'FALLIDO';
  await mostrar();
  expect(screen.getByRole('button', { name: 'Reintentar análisis' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Registrar dictamen' })).not.toBeInTheDocument();
});

it('debería conservar las observaciones cuando el servidor rechaza el envío', async () => {
  state.estado = 'EN_REVISION';
  await mostrar();
  fireEvent.click(screen.getByRole('radio', { name: /Rechazar/ }));
  fireEvent.change(screen.getByLabelText(/Observaciones/), {
    target: { value: 'La foto es una reproducción' },
  });
  vi.mocked(apiFetch).mockRejectedValueOnce(
    new ApiError('ERROR_INTERNO', 500, 'No se pudo registrar'),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Registrar dictamen' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo registrar');
  expect(screen.getByLabelText(/Observaciones/)).toHaveValue('La foto es una reproducción');
  expect(screen.getByRole('button', { name: 'Registrar dictamen' })).toBeEnabled();
});
