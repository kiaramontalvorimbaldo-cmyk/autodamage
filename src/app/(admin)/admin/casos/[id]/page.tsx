import Link from 'next/link';
import { RecoverWorkOrder, RecoverAnalysis } from '@/components/recover-work-order';
import { requireUser } from '@/lib/auth/require-user';
import { AppError } from '@/lib/errors';
import { getClaim } from '@/application/use-cases/get-claim';
import {
  getClaimRepository,
  getStorageService,
  getWorkOrderRepository,
  getAuditRepository,
} from '@/composition';
import { AnalysisBasis } from '@/components/analysis-basis';
import { AnalysisProvenance } from '@/components/analysis-provenance';
import { EvidenceImage } from '@/components/evidence-image';

export default async function CasoAdmin({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUser();
  if (usuario.rol !== 'ADMIN') throw new AppError('SIN_PERMISO', 403);
  const { id } = await params;
  const detalle = await getClaim(
    {
      repositorio: getClaimRepository(),
      almacen: getStorageService(),
      ordenes: getWorkOrderRepository(),
    },
    id,
    usuario.usuarioId,
    'ADMIN',
  );
  const auditoria = getAuditRepository();
  const registros = [
    ...(await auditoria.listarPorEntidad('siniestro', id)),
    ...(await auditoria.listarPorEntidad('siniestros', id)),
    ...(detalle.orden ? await auditoria.listarPorEntidad('ordenes_trabajo', detalle.orden.id) : []),
  ].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
  return (
    <section className="space-y-5">
      <Link href="/admin/casos" className="text-primary underline">
        ← Casos
      </Link>
      <h1 className="text-2xl font-semibold">Siniestro {id.slice(0, 8)}</h1>
      <p>
        {detalle.siniestro?.estado} · {detalle.taller?.nombre ?? 'Sin taller asignado'}
      </p>
      <AnalysisProvenance inspeccion={detalle.inspeccion} />
      <AnalysisBasis inspeccion={detalle.inspeccion} />
      {detalle.siniestro?.analisisEstado === 'EN_PROCESO' &&
        detalle.siniestro.analisisIniciadoEn &&
        Date.now() - new Date(detalle.siniestro.analisisIniciadoEn).getTime() > 300000 && (
          <RecoverAnalysis id={id} />
        )}
      {!detalle.orden &&
        detalle.siniestro &&
        (['APROBADO', 'FAST_TRACK'].includes(detalle.siniestro.estado) ||
          (detalle.siniestro.estado === 'EN_REVISION' &&
            (detalle.inspeccion?.dictamenFinal === 'APROBADO' ||
              (detalle.siniestro.ruta === 'VERDE' && !detalle.inspeccion?.dictamenFinal)))) && (
          <RecoverWorkOrder id={id} />
        )}
      <div className="grid gap-4 sm:grid-cols-2">
        {detalle.imagenes.map((i, n) => (
          <EvidenceImage
            key={i.id}
            src={i.url}
            alt={`Evidencia ${n + 1}`}
            className="w-full rounded-xl"
          />
        ))}
      </div>
      <h2 className="font-semibold">Historial de decisiones</h2>
      {registros.map((r) => (
        <article key={r.id} className="rounded-xl border bg-white p-4">
          <strong>{r.accion}</strong>
          <p className="text-sm">
            {r.actorTipo} · {new Date(r.creadoEn).toLocaleString('es-BO')}
          </p>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">
            {JSON.stringify(r.datos, null, 2)}
          </pre>
        </article>
      ))}
    </section>
  );
}
