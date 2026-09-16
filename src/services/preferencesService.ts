import { profileService } from './profileService';
import { DatingPreferences } from '../types';

/**
 * Preferences live on the profile service now that both are a single pair of
 * RPCs. Kept as a named export so callers read clearly.
 */
export const preferencesService = {
  getPreferences: (): Promise<DatingPreferences> => profileService.getPreferences(),
  updatePreferences: (prefs: DatingPreferences): Promise<DatingPreferences> =>
    profileService.updatePreferences(prefs),
};
