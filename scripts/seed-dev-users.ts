import { loadEnvLocal, requireEnv } from './lib/load-env';
import {
  developmentUsersPlan,
  readDevelopmentUsers,
} from '../src/application/validations/development-users';
import { provisionDevelopmentUser } from '../src/application/use-cases/provision-development-user';
import { developmentUserRepository } from '../src/infrastructure/supabase/development-user-repository';
import { AppError } from '../src/lib/errors';
import { ZodError } from 'zod';

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  if (
    args.some((arg) => arg !== '--apply' && arg !== '--plan') ||
    (args.includes('--apply') && args.includes('--plan'))
  )
    throw new AppError(
      'SEED_ARGUMENTOS_INVALIDOS',
      400,
      'Usa --plan para revisar o --apply para crear las cuentas.',
    );
  if (!args.includes('--apply')) {
    for (const item of developmentUsersPlan(process.env))
      console.log(
        item.email +
          ' → ' +
          item.rol +
          ' · contraseña ' +
          (item.passwordConfigured ? 'configurada' : 'pendiente (mínimo 8 caracteres)'),
      );
    console.log(
      'Plan únicamente. No se consultó ni modificó ningún servicio. Para crear las cuentas, revisa la configuración y usa --apply.',
    );
    return;
  }
  // Validar el lote completo antes de crear la primera cuenta.
  const users = readDevelopmentUsers(process.env);
  const repository = developmentUserRepository(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  );
  for (const user of users) {
    console.log('Preparando ' + user.email + ' (' + user.rol + ')');
    const result = await provisionDevelopmentUser(repository, user);
    console.log(
      result.email +
        ' → ' +
        result.rol +
        ' · ' +
        (result.estado === 'CREADO' ? 'creada' : 'existente, sin cambios'),
    );
  }
  console.log('Todas las cuentas de desarrollo se verificaron o crearon correctamente.');
}
main().catch((error) => {
  if (error instanceof ZodError)
    console.error(
      'Configuración inválida: revisa los correos y las cinco variables DEV_*_PASSWORD (mínimo 8 caracteres).',
    );
  else if (error instanceof AppError) console.error(error.code + ': ' + error.message);
  else
    console.error(
      'No se pudo completar la preparación. Revisa la configuración antes de reintentar.',
    );
  process.exitCode = 1;
});
