'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registroSchema } from '@/application/validations/auth';
import type { ZodIssue } from 'zod';
import Link from 'next/link';
import { mensajeDeCodigo } from '@/lib/user-messages';
import { toast } from 'sonner';

/**
 * POST /api/auth/registro.
 * El registro público siempre crea usuarios con rol ASEGURADO.
 */
export default function RegistroPage() {
  const router = useRouter();
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrores({});
    setErrorGeneral('');
    setAviso('');

    const form = new FormData(event.currentTarget);
    const datos = {
      nombreCompleto: String(form.get('nombreCompleto') ?? ''),
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    };

    const parsed = registroSchema.safeParse(datos);
    if (!parsed.success) {
      const porCampo: Record<string, string> = {};
      for (const issue of parsed.error.issues as ZodIssue[]) {
        const campo = issue.path[0];
        if (campo && !porCampo[campo]) porCampo[campo] = issue.message;
      }
      setErrores(porCampo);
      return;
    }

    setEnviando(true);
    try {
      const respuesta = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!respuesta.ok) {
        const message = mensajeDeCodigo('REGISTRO_ERROR');
        setErrorGeneral(message);
        toast.error(message);
        return;
      }
      if (respuesta.status === 202) {
        const message = mensajeDeCodigo('CONFIRMACION_PENDIENTE');
        setAviso(message);
        toast.success(message);
        return;
      }
      router.push('/asegurado');
      router.refresh();
    } catch {
      const message = mensajeDeCodigo('SIN_CONEXION');
      setErrorGeneral(message);
      toast.error(message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Crear cuenta</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Registro de asegurado. Los demás roles los crea un administrador.
        </p>
      </div>

      {aviso && (
        <p role="status" className="bg-muted rounded-md p-3">
          {aviso}{' '}
          <Link href="/login" className="underline">
            Iniciar sesión
          </Link>
        </p>
      )}
      <form method="post" className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="nombreCompleto">Nombre completo</Label>
          <Input
            id="nombreCompleto"
            name="nombreCompleto"
            autoComplete="name"
            placeholder="Ana Pérez"
            aria-invalid={Boolean(errores.nombreCompleto)}
          />
          {errores.nombreCompleto && (
            <p className="text-sm text-destructive" role="alert">
              {errores.nombreCompleto}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="tu@correo.com"
            aria-invalid={Boolean(errores.email)}
          />
          {errores.email && (
            <p className="text-sm text-destructive" role="alert">
              {errores.email}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errores.password)}
          />
          {errores.password && (
            <p className="text-sm text-destructive" role="alert">
              {errores.password}
            </p>
          )}
        </div>

        {errorGeneral && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {errorGeneral}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Registrarme'}
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        <Link href="/" className="underline">
          Volver al inicio
        </Link>
        <br />
        ¿Ya tienes cuenta?{' '}
        <a href="/login" className="font-medium text-primary hover:underline">
          Inicia sesión
        </a>
      </p>
    </>
  );
}
