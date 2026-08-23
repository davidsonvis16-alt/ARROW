import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

export interface SignUpData {
  email: string;
  password: string;
  name: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'woman' | 'man' | 'non-binary';
  location?: string;
  bio?: string;
  interests?: string[];
  lookingFor?: string;
  allowWhatsApp?: boolean;
  whatsappNumber?: string;
}

export const authService = {
  /**
   * Check if Supabase is properly initialized
   */
  isConfigured(): boolean {
    return isSupabaseConfigured && Boolean(supabase);
  },

  /**
   * Sign up a new user with email and password
   */
  async signUp(data: SignUpData): Promise<{ user: User | null; session: Session | null }> {
    if (!supabase) {
      throw new Error('Supabase client is not configured');
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
          date_of_birth: data.dateOfBirth,
          gender: data.gender,
        },
      },
    });

    if (authError) {
      throw authError;
    }

    // If a session or user is returned, create initial profile entry
    if (authData.user) {
      const { error: profileError } = await supabase.from('arrow_profiles').upsert({
        id: authData.user.id,
        name: data.name,
        date_of_birth: data.dateOfBirth,
        gender: data.gender,
        location: data.location || 'London, UK',
        bio: data.bio || '',
        interests: data.interests || [],
        looking_for: data.lookingFor || 'Meaningful dating',
        allow_whatsapp: Boolean(data.allowWhatsApp),
        whatsapp_number: data.whatsappNumber || null,
        is_verified_adult: true,
      });

      if (profileError) {
        console.error('Error creating profile after signup:', profileError);
      }

      // Also create default preferences
      await supabase.from('arrow_preferences').upsert({
        user_id: authData.user.id,
        age_min: 18,
        age_max: 65,
        gender_preference: ['woman', 'man', 'non-binary'],
        intentions: ['Meaningful dating'],
      });
    }

    return { user: authData.user, session: authData.session };
  },

  /**
   * Sign in an existing user with email and password
   */
  async signIn(email: string, password: string): Promise<{ user: User; session: Session }> {
    if (!supabase) {
      throw new Error('Supabase client is not configured');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    if (!data.user || !data.session) {
      throw new Error('No user session returned from sign in');
    }

    return { user: data.user, session: data.session };
  },

  /**
   * Sign out current user session
   */
  async signOut(): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },

  /**
   * Send a password reset email
   */
  async resetPassword(email: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase client is not configured');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    if (error) {
      throw error;
    }
  },

  /**
   * Get active session
   */
  async getSession(): Promise<Session | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error getting session:', error);
      return null;
    }
    return data.session;
  },

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      return null;
    }
    return data.user;
  },

  /**
   * Listen to auth state changes (sign in, sign out, token refresh)
   */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    if (!supabase) {
      return { unsubscribe: () => {} };
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return {
      unsubscribe: () => {
        subscription.unsubscribe();
      },
    };
  },
};
