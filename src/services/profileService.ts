import { getSupabase, supabase } from '../lib/supabase';
import { rpc, rpcSafe } from './rpc';
import { buildPhotoPath, forgetPhoto, resolvePhotoUrls } from './photoService';
import {
  DatingPreferences,
  FilterState,
  Gender,
  PromptItem,
  UserProfile,
} from '../types';

const BUCKET = 'arrow-profile-photos';

interface RawPhoto {
  path: string | null;
  url: string | null;
}

interface RawProfile {
  id: string;
  name: string;
  age: number | null;
  gender: UserProfile['gender'];
  location: string | null;
  bio: string | null;
  interests: string[] | null;
  lookingFor: string | null;
  prompts: PromptItem[] | null;
  allowWhatsApp: boolean;
  isVerifiedAdult: boolean;
  isPaused?: boolean;
  lastActiveAt?: string | null;
  createdAt: string;
  updatedAt: string;
  photos: RawPhoto[] | null;
  // Present only when the server decided you are entitled to them.
  dateOfBirth?: string | null;
  whatsappNumber?: string | null;
  showOnlineStatus?: boolean;
}

/**
 * Map a server profile into the shape the UI uses, signing photo references on
 * the way through. The server chooses which fields exist; this function never
 * invents one, so a private field simply stays undefined.
 */
async function hydrate(raw: RawProfile | null): Promise<UserProfile | null> {
  if (!raw) return null;

  const photos = await resolvePhotoUrls((raw.photos || []).map((p) => p.path || p.url));

  return {
    id: raw.id,
    name: raw.name,
    dateOfBirth: raw.dateOfBirth || '',
    age: raw.age ?? 0,
    gender: raw.gender,
    location: raw.location || '',
    bio: raw.bio || '',
    photos,
    interests: raw.interests || [],
    lookingFor: raw.lookingFor || 'Meaningful dating',
    prompts: Array.isArray(raw.prompts) ? raw.prompts : [],
    allowWhatsApp: Boolean(raw.allowWhatsApp),
    whatsappNumber: raw.whatsappNumber || undefined,
    isVerifiedAdult: Boolean(raw.isVerifiedAdult),
    lastActiveAt: raw.lastActiveAt ?? null,
    isPaused: Boolean(raw.isPaused),
    showOnlineStatus: raw.showOnlineStatus ?? true,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export async function hydrateProfile(raw: unknown): Promise<UserProfile | null> {
  return hydrate(raw as RawProfile | null);
}

export const profileService = {
  /** Your own profile, including the private fields you are entitled to. */
  async getMyProfile(): Promise<UserProfile | null> {
    return hydrate(await rpc<RawProfile | null>('arrow_get_my_profile'));
  },

  /**
   * Another user's profile. The server returns null unless a relationship
   * justifies the read, so a guessed id yields nothing.
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    return hydrate(await rpc<RawProfile | null>('arrow_get_profile', { p_profile_id: userId }));
  },

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const raw = await rpc<RawProfile>('arrow_upsert_my_profile', {
      p_name: updates.name ?? null,
      p_gender: updates.gender ?? null,
      p_location: updates.location ?? null,
      p_bio: updates.bio ?? null,
      p_interests: updates.interests ?? null,
      p_looking_for: updates.lookingFor ?? null,
      p_prompts: updates.prompts ?? null,
    });

    const profile = await hydrate(raw);
    if (!profile) throw new Error('Could not load your profile after saving.');
    return profile;
  },

  /** Consent for contact sharing. The number itself never comes back here. */
  async setWhatsApp(allow: boolean, number?: string): Promise<UserProfile> {
    const raw = await rpc<RawProfile>('arrow_set_whatsapp', {
      p_allow: allow,
      p_number: number ?? null,
    });

    const profile = await hydrate(raw);
    if (!profile) throw new Error('Could not load your profile after saving.');
    return profile;
  },

  async setVisibility(isPaused: boolean, showOnlineStatus?: boolean): Promise<UserProfile | null> {
    return hydrate(
      await rpc<RawProfile>('arrow_set_visibility', {
        p_is_paused: isPaused,
        p_show_online_status: showOnlineStatus ?? null,
      })
    );
  },

  async getDiscoverProfiles(filters?: FilterState): Promise<UserProfile[]> {
    const genders = filters?.genders?.filter((g): g is Exclude<Gender, 'everyone'> => g !== 'everyone');

    const raw = await rpcSafe<RawProfile[]>(
      'arrow_get_discover_feed',
      {
        p_age_min: filters?.ageMin ?? null,
        p_age_max: filters?.ageMax ?? null,
        p_genders: genders && genders.length > 0 ? genders : null,
        p_location: filters?.location?.trim() || null,
        p_interests: filters?.interests?.length ? filters.interests : null,
        p_looking_for: filters?.lookingFor?.length ? filters.lookingFor : null,
        p_limit: 30,
      },
      []
    );

    const profiles = await Promise.all(raw.map(hydrate));
    return profiles.filter((p): p is UserProfile => p !== null);
  },

  async getPreferences(): Promise<DatingPreferences> {
    return rpc<DatingPreferences>('arrow_get_my_preferences');
  },

  async updatePreferences(prefs: DatingPreferences): Promise<DatingPreferences> {
    return rpc<DatingPreferences>('arrow_set_my_preferences', {
      p_age_min: prefs.ageMin,
      p_age_max: prefs.ageMax,
      p_gender_preference: prefs.genderPreference.filter((g) => g !== 'everyone'),
      p_location_preference: prefs.locationPreference ?? null,
      p_max_distance_km: prefs.maxDistanceKm ?? 100,
      p_intentions: prefs.intentions,
    });
  },

  /**
   * Upload to your own storage folder, then register the path. The server
   * rejects a path outside your folder, so a tampered client cannot attach an
   * image to somebody else's profile.
   */
  async uploadProfilePhoto(userId: string, file: File | Blob): Promise<string> {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image size must be less than 5MB.');
    }

    const path = buildPhotoPath(userId, file);

    const { error: uploadError } = await getSupabase()
      .storage.from(BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      throw new Error(uploadError.message || 'Could not upload that photo.');
    }

    await rpc('arrow_add_photo', { p_storage_path: path, p_photo_url: null });

    const [url] = await resolvePhotoUrls([path]);
    return url || path;
  },

  async deleteProfilePhoto(photoRef: string): Promise<void> {
    await rpc('arrow_delete_photo', { p_storage_path: photoRef });
    forgetPhoto(photoRef);

    if (supabase && !photoRef.startsWith('http')) {
      await supabase.storage.from(BUCKET).remove([photoRef]).catch(() => undefined);
    }
  },

  async reorderPhotos(paths: string[]): Promise<void> {
    await rpc('arrow_reorder_photos', { p_paths: paths });
  },

  /** The one path to a match's phone number, and only with their consent. */
  async getMatchWhatsApp(matchId: string): Promise<{ allowWhatsApp: boolean; whatsappNumber: string | null }> {
    const data = await rpcSafe<{ allowWhatsApp: boolean; whatsappNumber: string | null }>(
      'arrow_get_match_whatsapp_contact',
      { p_match_id: matchId },
      { allowWhatsApp: false, whatsappNumber: null }
    );

    return {
      allowWhatsApp: Boolean(data.allowWhatsApp),
      whatsappNumber: data.whatsappNumber || null,
    };
  },

  async touchActivity(): Promise<void> {
    await rpcSafe('arrow_touch_activity', {}, null);
  },
};
