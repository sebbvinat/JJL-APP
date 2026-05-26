import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

// flowType: 'implicit' permite reset/login cross-device.
// PKCE (el default) guarda un code_verifier en localStorage; si el usuario
// pide el reset en un dispositivo y abre el mail en otro, falla.
// Implicit usa hash params (#access_token=...) y funciona en cualquier
// dispositivo. Tradeoff de seguridad menor, aceptable para nuestro caso.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: 'implicit' } }
  );
}
