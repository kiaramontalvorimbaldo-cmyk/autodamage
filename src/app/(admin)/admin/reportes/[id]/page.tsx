import Link from 'next/link';
import { z } from 'zod';
import { notFound } from 'next/navigation';
import { requirePortalUser } from '@/lib/auth/require-portal-user';
import { getClaim } from '@/application/use-cases/get-claim';
import {
  getClaimRepository,
  getStorageService,
  getWorkOrderRepository,
  getAuditRepository,
} from '@/composition';
import { consultarIdentificacionReporte } from '@/infrastructure/repositories/report-identification';
import { ClaimReport } from '@/components/reports/claim-report';
import { PrintReport } from '@/components/reports/print-report';
import { AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';
export default async function ReporteCaso({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePortalUser('ADMIN');
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const detalle = await getClaim(
    {
      repositorio: getClaimRepository(),
      almacen: getStorageService(),
      ordenes: getWorkOrderRepository(),
    },
    id,
    user.usuarioId,
    'ADMIN',
  ).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });
  if (!detalle.siniestro) notFound();
  const identificacion = await consultarIdentificacionReporte(
    detalle.siniestro.aseguradoId,
    detalle.siniestro.vehiculoId,
  );
  const audit = getAuditRepository();
  const grupos = await Promise.all([
    audit.listarPorEntidad('siniestro', id),
    audit.listarPorEntidad('siniestros', id),
    detalle.orden
      ? audit.listarPorEntidad('ordenes_trabajo', detalle.orden.id)
      : Promise.resolve([]),
  ]);
  const registros = Array.from(new Map(grupos.flat().map((r) => [r.id, r])).values()).sort((a, b) =>
    a.creadoEn.localeCompare(b.creadoEn),
  );
  return (
    <div className="space-y-5">
      <div className="report-tools flex flex-wrap gap-4">
        <Link href="/admin/reportes" className="text-primary underline">
          ← Reportes
        </Link>
        <Link href={`/admin/casos/${id}`} className="text-primary underline">
          Volver al expediente
        </Link>
      </div>
      <PrintReport />
      <ClaimReport
        detalle={detalle}
        identificacion={identificacion}
        registros={registros}
        emitidoEn={new Date().toISOString()}
        emitidoPor={user.nombre || 'Administración'}
      />
    </div>
  );
}
