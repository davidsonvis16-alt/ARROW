import { supabase } from '../lib/supabase';
import { DatingPreferences, Gender } from '../types';

const DEFAULT_PREFERENCES: DatingPreferences = {
  ageMin: 18,
  ageMax: 65,
  genderPreference: ['woman', 'man', 'non-binary'],
  intentions: ['Meaningful dating'],
};

export const preferencesService = {
  /**
   * Get user preferences from Supabase
   */
  async getPreferences(userId: string): Promise<DatingPreferences> {
    if (!supabase) return DEFAULT_PREFERENCES;

    const { data, error } = await supabase
      .from('arrow_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_PREFERENCES;
    }

    return {
      ageMin: data.age_min,
      ageMax: data.age_max,
      genderPreference: (data.gender_preference || ['woman', 'man', 'non-binary']) as Gender[],
      locationPreference: data.location_preference || undefined,
      maxDistanceKm: data.max_distance_km,
      intentions: data.intentions || ['Meaningful dating'],
    };
  },

  /**
   * Save / update user preferences in Supabase
   */
  async updatePreferences(userId: string, preferences: DatingPreferences): Promise<DatingPreferences> {
    if (!supabase) {
      throw new Error('Supabase client is not configured');
    }

    const { error } = await supabase
      .from('arrow_preferences')
      .upsert({
        user_id: userId,
        age_min: preferences.ageMin,
        age_max: preferences.ageMax,
        gender_preference: preferences.genderPreference,
        location_preference: preferences.locationPreference || null,
        max_distance_km: preferences.maxDistanceKm || 100,
        intentions: preferences.intentions,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw error;
    }

    return preferences;
  },
};
