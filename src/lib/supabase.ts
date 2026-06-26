import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const REQUEST_TIMEOUT_MS = 20000;

// After sleep/background, an in-flight fetch (e.g. a token refresh) can hang on
// a dead connection forever. Supabase serializes auth calls behind an internal
// lock, so one stuck request blocks every later query/mutation with no error.
// Aborting after a timeout releases the lock and lets the request fail/retry.
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId)
  );
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // For client-side usage we want to persist sessions
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: { fetch: fetchWithTimeout }
});

export const createSupabaseClient = () => {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: { fetch: fetchWithTimeout }
  });
};

export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.auth.getSession();
    // If we can get a session (even if null), connection is working
    return !error;
  } catch (error) {
    console.error('Supabase connection check failed:', error);
    return false;
  }
};

export const signInWithGoogle = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
};
