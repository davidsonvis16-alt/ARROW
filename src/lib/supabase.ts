import { createClient, SupabaseClient } from '@supabase/supabase-js';

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env || {};
const supabaseUrl: string = (env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey: string = (env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('your-project') &&
  !supabaseUrl.includes('placeholder')
);

// Create Supabase client singleton using public anon credentials
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Returns the active Supabase client or throws a descriptive error if not configured
 */
export function getSupabase(): SupabaseClient {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
    );
  }
  return supabase;
}
