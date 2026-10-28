import { BackButton } from '@/components/layout/back-button';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { NewClaimWizard } from '@/components/claim/new-claim-wizard';

export default function NuevoSiniestroPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <Breadcrumbs
        migas={[
          { etiqueta: 'Inicio', href: '/asegurado' },
          { etiqueta: 'Mis siniestros', href: '/asegurado/siniestros' },
          { etiqueta: 'Reportar siniestro' },
        ]}
      />
      <BackButton fallbackHref="/asegurado/siniestros" />
      <h1 className="text-xl font-semibold">Reportar siniestro</h1>
      <p className="text-muted-foreground text-sm">
        Necesitamos el vehículo, los datos del incidente y de 3 a 5 fotos tomadas en el momento.
      </p>

      <NewClaimWizard />
    </section>
  );
}