'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginSchema } from '@/application/validations/auth';
import { mensajeDeCodigo } from '@/lib/user-messages';
export default function LoginPage() {
  const router = useRouter();
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrores({});
    setErrorGeneral('');
    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: form.get('email'),
      password: form.get('password'),
    });
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[String(issue.path[0])] = issue.message;
      setErrores(fields);
      return;
    }
    setEnviando(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json()) as { destino?: string; error?: { code?: string } };
      if (!response.ok) {
        const message = mensajeDeCodigo(body.error?.code ?? 'CREDENCIALES_INVALIDAS');
        setErrorGeneral(message);
        toast.error(message);
        return;
      }
      const destination = ['/asegurado', '/perito', '/taller', '/admin'].includes(
        body.destino ?? '',
      )
        ? body.destino!
        : '/login';
      router.replace(destination);
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
        <h1 className="text-2xl font-bold tracking-tight">Iniciar sesión</h1>
        <p className="text-muted-foreground mt-1 text-sm">Accede a tu espacio de atención.</p>
      </div>
      <form method="post" className="space-y-4" onSubmit={submit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errores.email}
          />
          {errores.email && (
            <p role="alert" className="text-sm text-destructive">
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
            autoComplete="current-password"
            aria-invalid={!!errores.password}
          />
          {errores.password && (
            <p role="alert" className="text-sm text-destructive">
              {errores.password}
            </p>
          )}
        </div>
        {errorGeneral && (
          <p role="alert" className="text-sm text-destructive">
            {errorGeneral}
          </p>
        )}
        <Button type="submit" disabled={enviando} className="w-full">
          {enviando ? 'Iniciando sesión…' : 'Entrar'}
        </Button>
      </form>
      <p className="text-center text-sm">
        ¿No tienes cuenta?{' '}
        <Link href="/registro" className="text-primary underline">
          Regístrate
        </Link>
      </p>
      <Link href="/" className="text-sm text-primary underline">
        Volver al inicio
      </Link>
    </>
  );
}
