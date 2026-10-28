import type { InspeccionPericial } from '@/domain/entities';

export function AnalysisProvenance({ inspeccion }: { inspeccion: InspeccionPericial | null }) {
  if (!inspeccion) return null;
  const simulado =
    /mock|demo|test/i.test(inspeccion.modeloIa ?? '') ||
    (inspeccion.versionPrompt ?? '').startsWith('mock-');
  if (simulado)
    return (
      <p
        role="status"
        className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
      >
        <strong>Análisis simulado de prueba.</strong> Este resultado no valida las fotos ni su
        autenticidad. Activar Gemini no cambia los casos analizados anteriormente.
      </p>
    );
  if (!inspeccion.modeloIa) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Análisis con {inspeccion.modeloIa} · {inspeccion.versionPrompt}. La IA orienta; los casos
      dudosos requieren revisión humana.
    </p>
  );
}
