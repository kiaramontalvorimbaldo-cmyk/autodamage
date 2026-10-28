import Link from 'next/link';
import { ArrowUpRight, Camera, LockKeyhole, Route, Wrench } from 'lucide-react';
import { Brand } from '@/components/brand';
import { VehicleIllustration } from '@/components/auth/vehicle-illustration';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-showcase" aria-label="AutoDamage AI">
        <Link
          href="/"
          className="relative z-10 w-fit rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"
        >
          <Brand inverse />
        </Link>
        <div className="auth-story">
          <p className="brand-eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> INTELIGENCIA QUE TE
            ACOMPAÑA
          </p>
          <h2>
            Un imprevisto.
            <br />
            <span>Un camino claro.</span>
          </h2>
          <p className="auth-description">
            Del primer reporte a la reparación. Una forma más simple de cuidar lo que te mueve.
          </p>
          <VehicleIllustration />
          <div className="auth-steps">
            {[
              { icon: Camera, title: 'Captura', text: 'Comparte lo que pasó' },
              { icon: Route, title: 'Entiende', text: 'Conoce el siguiente paso' },
              { icon: Wrench, title: 'Avanza', text: 'Sigue tu reparación' },
            ].map(({ icon: Icon, title, text }, index) => (
              <div key={title}>
                <span className="auth-step-number">0{index + 1}</span>
                <Icon className="mb-3 h-5 w-5 text-emerald-200" aria-hidden="true" />
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-xs text-slate-400">
          Tecnología para orientar. Personas para decidir.
        </p>
      </section>
      <section className="auth-access" aria-label="Acceso a tu cuenta">
        <div className="auth-access-top">
          <span className="text-xs font-semibold tracking-wide text-slate-500">
            TU TRANQUILIDAD, EN MARCHA
          </span>
          <ArrowUpRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
        </div>
        <div className="auth-form-area">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          <div className="auth-form-card">
            <div className="auth-form-mark" aria-hidden="true">
              <LockKeyhole className="h-5 w-5" />
            </div>
            {children}
          </div>
          <p className="auth-private-note">
            <LockKeyhole className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Un espacio privado
            para ti y tu vehículo.
          </p>
        </div>
        <p className="auth-access-bottom">
          AutoDamage AI <span>Hecho para seguir adelante.</span>
        </p>
      </section>
    </main>
  );
}
