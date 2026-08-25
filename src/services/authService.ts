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
   * Sign in with Google OAuth
   */
  async signInWithGoogle(): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase client is not configured');
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      throw error;
    }
  },

  /**
   * Resend email verification
   */
  async resendEmailVerification(email: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase client is not configured');
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });

    if (error) {
      throw error;
    }
  },

  /**
   * Check if the current user's email is verified
   */
  async checkEmailVerification(): Promise<boolean> {
    const user = await this.getCurrentUser();
    if (!user) {
      return false;
    }
    return Boolean(user.email_confirmed_at);
  },

  /**
   * Complete age verification server-side
   */
  async completeAgeVerification(dateOfBirth: string): Promise<{ success: boolean; age?: number; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Supabase client is not configured' };
    }

    const { data, error } = await supabase.rpc('arrow_complete_age_verification', {
      p_date_of_birth: dateOfBirth,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && !data.success) {
      return { success: false, error: data.error };
    }

    if (data && data.success) {
      return { success: true, age: data.age };
    }

    return { success: false, error: 'Verification failed' };
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
   * Update the current user's last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    if (!supabase) return;
    try {
      await supabase
        .from('arrow_profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (err) {
      console.error('Error updating last login:', err);
    }
  },

  /**
   * Delete the current user's account and all associated data
   */
  async deleteAccount(): Promise<void> {
    if (!supabase) return;

    const user = await this.getCurrentUser();
    if (!user) {
      await this.signOut();
      return;
    }

    try {
      const { data: photos } = await supabase
        .from('arrow_profile_photos')
        .select('photo_url')
        .eq('user_id', user.id);

      if (photos && photos.length > 0) {
        const paths = photos
          .map((p) => {
            try {
              const url = new URL(p.photo_url);
              const parts = url.pathname.split('arrow-profile-photos/');
              return parts.length > 1 ? decodeURIComponent(parts[1]) : null;
            } catch {
              return null;
            }
          })
          .filter(Boolean) as string[];

        if (paths.length > 0) {
          await supabase.storage.from('arrow-profile-photos').remove(paths);
        }
      }

      await supabase.from('arrow_profiles').delete().eq('id', user.id);
    } catch (err) {
      console.error('Error deleting account data:', err);
    }

    await this.signOut();
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
