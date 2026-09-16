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
   * Record that the current user is active. There is no user id parameter:
   * the database stamps whoever the session says you are, so this cannot be
   * used to touch another account.
   */
  async updateLastLogin(): Promise<void> {
    if (!supabase) return;
    try {
      await supabase.rpc('arrow_touch_activity');
    } catch (err) {
      console.warn('Could not record activity:', err);
    }
  },

  /**
   * Set a new password. Used after following a reset link, where Supabase has
   * already exchanged the token for a session.
   */
  async updatePassword(newPassword: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase client is not configured');
    }

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw error;
    }
  },

  /**
   * Delete the current user's account and everything attached to it.
   *
   * The profile row is removed by a server function that acts on the session's
   * own user, and every arrow_* row cascades from it. Storage is cleared by
   * listing the caller's own folder, which the storage policy scopes to them.
   */
  async deleteAccount(): Promise<void> {
    if (!supabase) return;

    const user = await this.getCurrentUser();
    if (!user) {
      await this.signOut();
      return;
    }

    try {
      const { data: files } = await supabase.storage
        .from('arrow-profile-photos')
        .list(user.id, { limit: 100 });

      if (files && files.length > 0) {
        await supabase.storage
          .from('arrow-profile-photos')
          .remove(files.map((f) => `${user.id}/${f.name}`));
      }
    } catch (err) {
      console.warn('Could not clear stored photos:', err);
    }

    const { error } = await supabase.rpc('arrow_delete_my_account');
    if (error) {
      throw new Error(error.message || 'Could not delete your account.');
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
