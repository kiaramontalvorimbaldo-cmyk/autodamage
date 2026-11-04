import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ClaimReport } from './claim-report';
import type { DetalleSiniestro } from '@/application/use-cases/get-claim';

const detalle: DetalleSiniestro = {
  siniestro: {
    id: 'caso-1',
    aseguradoId: 'u1',
    vehiculoId: 'v1',
    fechaRegistro: '2026-11-03T12:00:00Z',
    fechaIncidente: '2026-11-03T11:00:00Z',
    latitud: -16,
    longitud: -68,
    descripcion: 'Golpe lateral',
    estado: 'PENDIENTE',
    ruta: null,
    analisisEstado: 'NO_INICIADO',
    requiereInspeccionPresencial: false,
    etiquetas: [],
  },
  inspeccion: null,
  imagenes: [],
  evaluaciones: [],
  orden: null,
  taller: null,
};
const identificacion = {
  asegurado: 'Ana Prueba',
  matricula: '123-ABC',
  marca: 'Toyota',
  modelo: 'Corolla',
  poliza: 'POL-001',
};
describe('informe de siniestro', () => {
  it('debería conservar pendientes sin inventar aprobación, taller ni importes', () => {
    render(
      <ClaimReport
        detalle={detalle}
        identificacion={identificacion}
        registros={[]}
        emitidoEn="2026-11-03T12:00:00Z"
        emitidoPor="Admin"
      />,
    );
    expect(screen.getByText('Ana Prueba')).toBeInTheDocument();
    expect(screen.getByText('POL-001')).toBeInTheDocument();
    expect(screen.getByText('Pendiente de dictamen humano')).toBeInTheDocument();
    expect(screen.getByText(/Sin partidas de daños/)).toBeInTheDocument();
    expect(screen.queryByText('0.00 USD')).not.toBeInTheDocument();
  });
  it('debería mostrar el rechazo separado del monto de una orden sin convertirlo en aprobación', () => {
    const inspeccion: NonNullable<DetalleSiniestro['inspeccion']> = {
      id: 'i1',
      siniestroId: 'caso-1',
      peritoId: 'p1',
      fechaInspeccion: '2026-11-03T12:00:00Z',
      tipoInspeccion: 'DIGITAL_IA',
      kilometraje: null,
      observacionesPerito: 'Evidencia no corresponde al incidente',
      dictamenFinal: 'RECHAZADO',
      verdictFraude: 'SOSPECHA_RECAPTURA',
      indicadoresFraude: ['SOSPECHA_RECAPTURA'],
      nivelSeveridad: null,
      costoTotalEstimado: null,
      confianzaGlobal: null,
      modeloIa: 'modelo-prueba',
      versionPrompt: '1.2',
      respuestaIa: null,
    };
    render(
      <ClaimReport
        detalle={{ ...detalle, inspeccion }}
        identificacion={identificacion}
        registros={[]}
        emitidoEn="2026-11-03T12:00:00Z"
        emitidoPor="Admin"
      />,
    );
    expect(screen.getAllByText(/RECHAZADO/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Observaciones del perito: Evidencia no corresponde/),
    ).toBeInTheDocument();
    expect(screen.getByText(/no incorpora firma digital/)).toBeInTheDocument();
  });
});
