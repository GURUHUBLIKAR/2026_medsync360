import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

type UserProfile = Database['public']['Tables']['users']['Row'];

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: Partial<UserProfile>) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  initialize: () => Promise<void>;
  clearCache: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    try {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession();
      
      // Set up auth state change listener.
      // IMPORTANT: keep this callback SYNCHRONOUS. Calling supabase.from()/
      // supabase.auth.* directly inside it can deadlock Supabase's internal auth
      // lock when the event was itself triggered by a token refresh. Defer any
      // Supabase work to a microtask-free setTimeout(..., 0) so the lock is
      // released before we issue the follow-up request.
      supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
        console.log('Auth state changed:', event, session?.user?.email);

        if (session?.user) {
          // User is signed in, fetch their profile (deferred — see note above).
          setTimeout(async () => {
            try {
              const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();

              if (profileError) {
                console.warn('Profile fetch error:', profileError);
              }

              set({
                user: session.user,
                profile,
                loading: false,
                initialized: true
              });
            } catch (error) {
              console.error('Error fetching profile:', error);
              set({
                user: session.user,
                profile: null,
                loading: false,
                initialized: true
              });
            }
          }, 0);
        } else {
          // User is signed out
          set({
            user: null,
            profile: null,
            loading: false,
            initialized: true
          });

          // Clear cache when user signs out
          get().clearCache();
        }
      });

      // Handle initial session if it exists
      if (session?.user) {
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) {
          console.warn('Initial profile fetch error:', profileError);
        }

        set({ user: session.user, profile, initialized: true });
      } else {
        set({ user: null, profile: null, initialized: true });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ user: null, profile: null, initialized: true });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Don't manually set state here - let onAuthStateChange handle it
      // This prevents race conditions and ensures consistent state management
      console.log('Sign in successful, waiting for auth state change...');
      
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  signUp: async (email: string, password: string, userData: Partial<UserProfile>) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: data.user.email!,
            full_name: userData.full_name || '',
            role: userData.role || 'PG',
            department: userData.department || '',
            kmc_number: userData.kmc_number || null,
            aadhar_number: userData.aadhar_number || null,
            phone: userData.phone || null,
          });

        if (profileError) throw profileError;

        // Let onAuthStateChange handle the state update
        console.log('Sign up successful, profile created');
      }
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  signOut: async () => {
    set({ loading: true });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // onAuthStateChange will handle clearing the state
      console.log('Sign out successful');
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  updateProfile: async (updates: Partial<UserProfile>) => {
    const { user } = get();
    if (!user) return;

    set({ loading: true });
    try {
      // Use upsert to handle both insert and update cases
      const { data, error } = await supabase
        .from('users')
        .upsert({ ...updates, id: user.id, email: user.email })
        .select()
        .single();

      if (error) throw error;
      
      // Update the profile state immediately for better UX
      set({ profile: data, loading: false });
      
      // Clear cache when profile is updated
      get().clearCache();
      
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  clearCache: () => {
    // Clear dashboard cache when user signs out or profile changes
    localStorage.removeItem('dashboard-cache');
    sessionStorage.removeItem('dashboard-activities');
  },
}));