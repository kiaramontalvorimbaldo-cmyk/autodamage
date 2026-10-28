import { SaludoPerfil } from '@/components/saludo-perfil';
import { ResumenAsegurado } from '@/components/claim/resumen-asegurado';

export default function AseguradoPage() {
  return (
    <section className="space-y-6">
      <SaludoPerfil />
      <ResumenAsegurado />
    </section>
  );
}