import { supabase } from '../lib/supabase';
import { UserProfile, FilterState } from '../types';

export const profileService = {
  /**
   * Fetch full profile by user ID
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    if (!supabase) return null;

    const { data: profileData, error: profileError } = await supabase
      .from('arrow_profiles')
      .select(`
        id,
        name,
        date_of_birth,
        age,
        gender,
        location,
        bio,
        interests,
        looking_for,
        prompts,
        allow_whatsapp,
        whatsapp_number,
        is_verified_adult,
        created_at,
        updated_at
      `)
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profileData) {
      return null;
    }

    // Fetch ordered photos
    const { data: photoData } = await supabase
      .from('arrow_profile_photos')
      .select('photo_url, display_order')
      .eq('user_id', userId)
      .order('display_order', { ascending: true });

    const photos = (photoData || []).map((p) => p.photo_url);

    return {
      id: profileData.id,
      name: profileData.name,
      dateOfBirth: profileData.date_of_birth,
      age: profileData.age,
      gender: profileData.gender,
      location: profileData.location,
      bio: profileData.bio || '',
      interests: profileData.interests || [],
      lookingFor: profileData.looking_for || 'Meaningful dating',
      prompts: Array.isArray(profileData.prompts) ? profileData.prompts : [],
      allowWhatsApp: Boolean(profileData.allow_whatsapp),
      whatsappNumber: profileData.whatsapp_number || undefined,
      isVerifiedAdult: Boolean(profileData.is_verified_adult),
      createdAt: profileData.created_at,
      updatedAt: profileData.updated_at,
      photos,
    };
  },

  /**
   * Update profile information
   */
  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    if (!supabase) {
      throw new Error('Supabase client is not configured');
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.gender !== undefined) payload.gender = updates.gender;
    if (updates.location !== undefined) payload.location = updates.location;
    if (updates.bio !== undefined) payload.bio = updates.bio;
    if (updates.interests !== undefined) payload.interests = updates.interests;
    if (updates.lookingFor !== undefined) payload.looking_for = updates.lookingFor;
    if (updates.prompts !== undefined) payload.prompts = updates.prompts;
    if (updates.allowWhatsApp !== undefined) payload.allow_whatsapp = updates.allowWhatsApp;
    if (updates.whatsappNumber !== undefined) payload.whatsapp_number = updates.whatsappNumber;

    const { error } = await supabase
      .from('arrow_profiles')
      .update(payload)
      .eq('id', userId);

    if (error) {
      throw error;
    }

    const updated = await this.getProfile(userId);
    if (!updated) {
      throw new Error('Failed to retrieve profile after update');
    }
    return updated;
  },

  /**
   * Safe discovery feed using secure database RPC
   * Ensures private data (DOB, WhatsApp phone) is NEVER returned to callers
   */
  async getDiscoverProfiles(filters?: FilterState): Promise<UserProfile[]> {
    if (!supabase) return [];

    const ageMin = filters?.ageMin ?? 18;
    const ageMax = filters?.ageMax ?? 65;
    const genders = filters?.genders && filters.genders.length > 0 && !filters.genders.includes('everyone')
      ? filters.genders
      : null;
    const location = filters?.location?.trim() || null;

    // Call secure Postgres RPC function
    const { data, error } = await supabase.rpc('arrow_get_discover_feed', {
      p_age_min: ageMin,
      p_age_max: ageMax,
      p_genders: genders,
      p_location: location,
    });

    if (error) {
      console.warn('RPC arrow_get_discover_feed error, falling back to secure view:', error);
      // Fallback to arrow_discoverable_profiles safe view
      const { data: viewData, error: viewError } = await supabase
        .from('arrow_discoverable_profiles')
        .select('*')
        .gte('age', ageMin)
        .lte('age', ageMax)
        .limit(30);

      if (viewError || !viewData) return [];

      return viewData.map((item: any) => ({
        id: item.id,
        name: item.name,
        dateOfBirth: '', // Private field omitted
        age: item.age,
        gender: item.gender,
        location: item.location,
        bio: item.bio || '',
        interests: item.interests || [],
        lookingFor: item.looking_for || 'Meaningful dating',
        prompts: Array.isArray(item.prompts) ? item.prompts : [],
        allowWhatsApp: Boolean(item.allow_whatsapp),
        // whatsappNumber is NOT included in view
        isVerifiedAdult: Boolean(item.is_verified_adult),
        createdAt: item.created_at,
        updatedAt: item.created_at,
        photos: item.photos || [],
      }));
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      dateOfBirth: '', // Never exposed
      age: item.age,
      gender: item.gender,
      location: item.location,
      bio: item.bio || '',
      interests: item.interests || [],
      lookingFor: item.looking_for || 'Meaningful dating',
      prompts: Array.isArray(item.prompts) ? item.prompts : [],
      allowWhatsApp: Boolean(item.allow_whatsapp),
      isVerifiedAdult: Boolean(item.is_verified_adult),
      createdAt: item.created_at,
      updatedAt: item.created_at,
      photos: item.photos || [],
    }));
  },

  /**
   * Upload profile photo to Supabase Storage bucket `arrow-profile-photos`
   */
  async uploadProfilePhoto(userId: string, file: File | Blob, order: number = 0): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase client is not configured');
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image size must be less than 5MB');
    }

    const fileExt = (file as File).name ? (file as File).name.split('.').pop() : 'jpg';
    const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('arrow-profile-photos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from('arrow-profile-photos')
      .getPublicUrl(fileName);

    const photoUrl = publicUrlData.publicUrl;

    // Record photo in arrow_profile_photos table
    await supabase.from('arrow_profile_photos').insert({
      user_id: userId,
      photo_url: photoUrl,
      display_order: order,
    });

    return photoUrl;
  },

  /**
   * Delete a profile photo from storage & database
   */
  async deleteProfilePhoto(userId: string, photoUrl: string): Promise<void> {
    if (!supabase) return;

    // Delete DB record
    await supabase
      .from('arrow_profile_photos')
      .delete()
      .eq('user_id', userId)
      .eq('photo_url', photoUrl);

    // Extract path from public URL if possible
    try {
      const url = new URL(photoUrl);
      const pathParts = url.pathname.split('arrow-profile-photos/');
      if (pathParts.length > 1) {
        const storagePath = decodeURIComponent(pathParts[1]);
        await supabase.storage.from('arrow-profile-photos').remove([storagePath]);
      }
    } catch {
      // Best effort for storage cleanup
    }
  },

  /**
   * Securely retrieve matched partner's WhatsApp number (only if mutual match exists)
   */
  async getMatchWhatsApp(matchId: string): Promise<{ allowWhatsApp: boolean; whatsappNumber: string | null }> {
    if (!supabase) {
      return { allowWhatsApp: false, whatsappNumber: null };
    }

    const { data, error } = await supabase.rpc('arrow_get_match_whatsapp_contact', {
      p_match_id: matchId,
    });

    if (error || !data) {
      console.warn('Error fetching match WhatsApp contact:', error);
      return { allowWhatsApp: false, whatsappNumber: null };
    }

    return {
      allowWhatsApp: Boolean(data.allowWhatsApp),
      whatsappNumber: data.whatsappNumber || null,
    };
  },
};
