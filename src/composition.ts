import { getEnv } from '@/lib/env';
import type { AiProvider } from '@/application/ports/ai-provider';
import type { AuditRepository } from '@/application/ports/audit-repository';
import type { BaremoRepository } from '@/application/ports/baremo-repository';
import type { ClaimRepository } from '@/application/ports/claim-repository';
import type { WorkOrderRepository } from '@/application/ports/work-order-repository';
import type { StorageService } from '@/application/ports/storage-service';
import type { ImageService } from '@/application/ports/image-service';
import type { Clock } from '@/application/ports/clock';
import { clockDelSistema } from '@/application/ports/clock';
import { GeminiProvider } from '@/infrastructure/ai/gemini-provider';
import { MockProvider } from '@/infrastructure/ai/mock-provider';
import { TokenBucketRateLimiter } from '@/infrastructure/ai/rate-limiter';
import {
  SupabaseAuditRepository,
  SupabaseBaremoRepository,
  SupabaseClaimRepository,
} from '@/infrastructure/repositories/supabase-repositories';
import { SupabaseWorkOrderRepository } from '@/infrastructure/repositories/supabase-work-order-repository';
import { SupabaseStorageService } from '@/infrastructure/storage/supabase-storage';
import type { StaffRepository } from '@/application/ports/staff-repository';
import { SupabaseStaffRepository } from '@/infrastructure/supabase/supabase-staff-repository';
import { SharpImageService } from '@/infrastructure/image/image-service';

/**
 * Composition root: instancia los adaptadores según AI_PROVIDER
 * y expone los casos de uso listos.
 */

export function getAiProvider(): AiProvider {
  return getEnv().AI_PROVIDER === 'gemini' ? new GeminiProvider() : new MockProvider();
}

export function getClaimRepository(): ClaimRepository {
  return new SupabaseClaimRepository();
}

export function getWorkOrderRepository(): WorkOrderRepository {
  return new SupabaseWorkOrderRepository();
}

export function getBaremoRepository(): BaremoRepository {
  return new SupabaseBaremoRepository();
}

export function getAuditRepository(): AuditRepository {
  return new SupabaseAuditRepository();
}

export function getStorageService(): StorageService {
  return new SupabaseStorageService();
}

export function getImageService(): ImageService {
  return new SharpImageService();
}

export function getClock(): Clock {
  return clockDelSistema;
}

/** Limitador de tasa por minuto (token bucket en memoria). */
export function getRateLimiter(): TokenBucketRateLimiter {
  const env = getEnv();
  return new TokenBucketRateLimiter(env.AI_MAX_RPM, env.AI_MAX_RPM);
}

export function getStaffRepository(): StaffRepository {
  return new SupabaseStaffRepository();
}

export { consultarAdministracion } from '@/infrastructure/repositories/admin-queries';
