import { crearId } from '@/lib/id';
export type AndroidBridge = { capture: (id: string) => void; location: (id: string) => void };
declare global {
  interface Window {
    AutoDamageAndroid?: AndroidBridge;
  }
}
export function androidDisponible() {
  return typeof window !== 'undefined' && !!window.AutoDamageAndroid;
}
export function solicitarAndroid<T>(action: keyof AndroidBridge): Promise<T> {
  return new Promise((resolve, reject) => {
    const bridge = window.AutoDamageAndroid;
    if (!bridge) return reject(new Error('NO_DISPONIBLE'));
    const id = crearId();
    const timeout = setTimeout(
      () => finish(undefined, 'TIMEOUT'),
      action === 'capture' ? 120000 : 15000,
    );
    function finish(data?: T, error?: string) {
      clearTimeout(timeout);
      window.removeEventListener('autodamage-native', receive);
      if (error) reject(new Error(error));
      else resolve(data as T);
    }
    function receive(event: Event) {
      const detail = (event as CustomEvent<{ id: string; data?: T; error?: string }>).detail;
      if (detail?.id === id) finish(detail.data, detail.error);
    }
    window.addEventListener('autodamage-native', receive);
    try {
      bridge[action](id);
    } catch {
      finish(undefined, 'NO_DISPONIBLE');
    }
  });
}
