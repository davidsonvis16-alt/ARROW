import React, { useState, useEffect, useCallback } from 'react';
import {
  UserProfile,
  TabType,
  FilterState,
  MatchRecord,
  ReportReason,
  DatingPreferences,
} from './types';
import { storageService } from './services/storageService';
import { api, authService, profileService } from './services/api';
import { isSupabaseConfigured } from './lib/supabase';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { ProfileCard } from './components/discover/ProfileCard';
import { ProfileDetailModal } from './components/discover/ProfileDetailModal';
import { MatchCelebrationModal } from './components/discover/MatchCelebrationModal';
import { FilterModal } from './components/discover/FilterModal';
import { LikesList } from './components/likes/LikesList';
import { MatchesList } from './components/matches/MatchesList';
import { MatchDetailModal } from './components/matches/MatchDetailModal';
import { ProfileView } from './components/profile/ProfileView';
import { EditProfileModal } from './components/profile/EditProfileModal';
import { EditPhotosModal } from './components/profile/EditPhotosModal';
import { PreferencesModal } from './components/profile/PreferencesModal';
import { WhatsAppModal } from './components/profile/WhatsAppModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { ReportModal } from './components/safety/ReportModal';
import { LegalModal, LegalDocType } from './components/safety/LegalModal';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { AuthModal } from './components/auth/AuthModal';
import { ToastProvider, useToast } from './components/ui/Toast';
import { Button } from './components/ui/Button';
import {
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  UserPlus,
  Database,
  ExternalLink,
  User,
  ShieldCheck,
} from 'lucide-react';

function ArrowApp() {
  const { showToast } = useToast();

  // App Navigation & Current User State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentTab, setCurrentTab] = useState<TabType>('discover');
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Discover State
  const [discoverProfiles, setDiscoverProfiles] = useState<UserProfile[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [cardAnimation, setCardAnimation] = useState<'like' | 'pass' | null>(null);
  const [isLoadingDiscover, setIsLoadingDiscover] = useState(true);

  // Likes & Matches State
  const [incomingLikes, setIncomingLikes] = useState<Array<{ profile: UserProfile }>>([]);
  const [matches, setMatches] = useState<Array<MatchRecord & { partnerProfile: UserProfile }>>([]);

  // Filters State
  const [filters, setFilters] = useState<FilterState>({
    ageMin: 18,
    ageMax: 60,
    genders: ['everyone'],
    location: '',
    interests: [],
    lookingFor: [],
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Modals & Drawers
  const [detailProfile, setDetailProfile] = useState<UserProfile | null>(null);
  const [matchCelebration, setMatchCelebration] = useState<{
    isOpen: boolean;
    partnerProfile: UserProfile | null;
    matchRecord?: MatchRecord;
  }>({
    isOpen: false,
    partnerProfile: null,
  });
  const [selectedMatch, setSelectedMatch] = useState<
    (MatchRecord & { partnerProfile: UserProfile }) | null
  >(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isEditPhotosOpen, setIsEditPhotosOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<UserProfile | null>(null);
  const [legalModal, setLegalModal] = useState<{
    isOpen: boolean;
    type: LegalDocType | null;
  }>({
    isOpen: false,
    type: null,
  });

  // 1. Initialize Supabase Auth & Session Restoration
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      if (isSupabaseConfigured) {
        try {
          const session = await authService.getSession();
          if (session?.user && mounted) {
            const profile = await profileService.getProfile(session.user.id);
            if (profile && mounted) {
              setCurrentUser(profile);
            }
          }
        } catch (err) {
          console.warn('Supabase session restore notice:', err);
        }
      } else {
        // Fallback to local session storage
        const currentId = storageService.getCurrentUserId();
        if (currentId && mounted) {
          const user = storageService.getProfile(currentId);
          if (user) {
            setCurrentUser(user);
          }
        }
      }
    }

    initSession();

    // Listen to Supabase Auth State changes
    const { unsubscribe } = authService.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await profileService.getProfile(session.user.id);
        if (profile && mounted) {
          setCurrentUser(profile);
        }
      } else if (event === 'SIGNED_OUT') {
        if (mounted) {
          setCurrentUser(null);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // 2. Refresh Feed, Likes & Matches data whenever currentUser or filters change
  const refreshAppData = useCallback(async () => {
    setIsLoadingDiscover(true);
    try {
      const [feed, likesData, matchesData] = await Promise.all([
        api.getDiscoverProfiles(currentUser?.id, filters),
        api.getLikes(currentUser?.id),
        api.getMatches(currentUser?.id),
      ]);
      setDiscoverProfiles(feed);
      setCardIndex(0);
      setIncomingLikes(likesData);
      setMatches(matchesData);
    } catch (err) {
      console.error('Failed to load ARROW app data', err);
    } finally {
      setIsLoadingDiscover(false);
    }
  }, [currentUser, filters]);

  useEffect(() => {
    refreshAppData();
  }, [refreshAppData]);

  // Discovery Actions
  const handleLike = async (targetProfile: UserProfile) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      showToast(`Log in or create a profile to send an Arrow to ${targetProfile.name}`, 'info');
      return;
    }

    setCardAnimation('like');
    try {
      const result = await api.likeProfile(currentUser.id, targetProfile.id);
      setTimeout(() => {
        setCardAnimation(null);
        setCardIndex((prev) => prev + 1);

        if (result.isMatch) {
          setMatchCelebration({
            isOpen: true,
            partnerProfile: targetProfile,
            matchRecord: result.matchRecord,
          });
          refreshAppData();
        }
      }, 250);
    } catch (err: any) {
      setCardAnimation(null);
      showToast(err.message || 'Error recording like', 'error');
    }
  };

  const handlePass = async (targetProfile: UserProfile) => {
    if (!currentUser) {
      setCardAnimation('pass');
      setTimeout(() => {
        setCardAnimation(null);
        setCardIndex((prev) => prev + 1);
      }, 250);
      return;
    }

    setCardAnimation('pass');
    try {
      await api.passProfile(currentUser.id, targetProfile.id);
      setTimeout(() => {
        setCardAnimation(null);
        setCardIndex((prev) => prev + 1);
      }, 250);
    } catch (err) {
      setCardAnimation(null);
      console.error(err);
    }
  };

  // Likes Tab Actions
  const handleLikeBackFromLikes = async (targetProfile: UserProfile) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    try {
      const result = await api.likeProfile(currentUser.id, targetProfile.id);
      if (result.isMatch) {
        setMatchCelebration({
          isOpen: true,
          partnerProfile: targetProfile,
          matchRecord: result.matchRecord,
        });
      }
      showToast(`Connected with ${targetProfile.name}!`, 'success');
      refreshAppData();
    } catch (err: any) {
      showToast(err.message || 'Error processing like', 'error');
    }
  };

  const handlePassFromLikes = async (targetProfile: UserProfile) => {
    if (!currentUser) return;
    try {
      await api.passProfile(currentUser.id, targetProfile.id);
      showToast(`Passed on ${targetProfile.name}`, 'info');
      refreshAppData();
    } catch (err) {
      console.error(err);
    }
  };

  // Matches Actions
  const handleUnmatch = async (matchId: string, partnerName: string) => {
    if (!currentUser) return;
    try {
      await api.unmatchUser(currentUser.id, matchId);
      showToast(`Unmatched with ${partnerName}`, 'info');
      refreshAppData();
    } catch (err) {
      showToast('Failed to unmatch', 'error');
    }
  };

  // Safety: Report & Block
  const handleSubmitReport = async (reason: ReportReason, details: string) => {
    if (!currentUser || !reportTarget) return;
    try {
      await api.reportUser(currentUser.id, reportTarget.id, reason, details);
      // Also automatically block the user
      await api.blockUser(currentUser.id, reportTarget.id);
      showToast(`Report received. ${reportTarget.name} has been blocked.`, 'info');
      setReportTarget(null);
      setDetailProfile(null);
      setSelectedMatch(null);
      refreshAppData();
    } catch (err) {
      showToast('Failed to submit report', 'error');
    }
  };

  // Profile Updates
  const handleUpdateProfile = async (updatedData: Partial<UserProfile>) => {
    if (!currentUser) return;
    const updated = await api.updateProfile(currentUser.id, updatedData);
    setCurrentUser(updated);
    showToast('Profile updated', 'success');
  };

  const handleUpdatePhotos = async (photos: string[]) => {
    if (!currentUser) return;
    const updated = await api.updateProfile(currentUser.id, { photos });
    setCurrentUser(updated);
  };

  const handleUpdatePreferences = async (prefs: DatingPreferences) => {
    if (!currentUser) return;
    await api.updatePreferences(currentUser.id, prefs);
  };

  const handleUpdateWhatsApp = async (
    allowWhatsApp: boolean,
    whatsappNumber: string
  ) => {
    if (!currentUser) return;
    const updated = await api.updateProfile(currentUser.id, {
      allowWhatsApp,
      whatsappNumber,
    });
    setCurrentUser(updated);
  };

  // Account Management
  const handleLogOut = async () => {
    if (isSupabaseConfigured) {
      try {
        await authService.signOut();
      } catch (err) {
        console.warn(err);
      }
    }
    storageService.setCurrentUserId(null);
    setCurrentUser(null);
    showToast('Logged out to guest mode', 'info');
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    await api.deleteAccount(currentUser.id);
    setCurrentUser(null);
    setIsSettingsOpen(false);
    showToast('Account deleted', 'info');
  };

  const handleSwitchProfile = (profileId: string) => {
    const profile = storageService.getProfile(profileId);
    if (profile) {
      storageService.setCurrentUserId(profile.id);
      setCurrentUser(profile);
      showToast(`Switched active profile to ${profile.name}`, 'info');
    }
  };

  const handleOnboardingComplete = (newProfile: UserProfile) => {
    storageService.saveProfile(newProfile);
    storageService.setCurrentUserId(newProfile.id);
    setCurrentUser(newProfile);
    setIsOnboarding(false);
    setCurrentTab('discover');
    showToast(`Welcome to ARROW, ${newProfile.name}!`, 'success');
  };

  const hasActiveFilters = Boolean(
    filters.ageMin > 18 ||
    filters.ageMax < 60 ||
    filters.location ||
    (filters.genders.length > 0 && !filters.genders.includes('everyone')) ||
    filters.interests.length > 0 ||
    filters.lookingFor.length > 0
  );

  // Active Discover Profile
  const currentDiscoverProfile =
    discoverProfiles.length > cardIndex ? discoverProfiles[cardIndex] : null;

  return (
    <div className="flex h-screen w-full bg-[#F5F3EE] font-sans text-[#111111] overflow-hidden select-none">
      {/* Left Navigation Sidebar for Desktop (Professional Polish Theme) */}
      <aside className="hidden lg:flex w-72 bg-[#111111] text-white flex-col justify-between py-10 px-8 shrink-0 z-20">
        {/* Brand Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-[#E85D2A] flex items-center justify-center transform rotate-45 rounded-[3px] shadow-sm">
              <div className="w-2 h-2 border-t-2 border-r-2 border-white transform -rotate-45 ml-[-1px] mt-[1px]" />
            </div>
            <span className="text-2xl font-bold tracking-tighter uppercase font-mono">
              ARROW
            </span>
          </div>
          <p className="text-[10px] text-white/40 tracking-widest uppercase font-medium pl-9">
            Human Dating & Discovery
          </p>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-6">
          <button
            type="button"
            onClick={() => setCurrentTab('discover')}
            className={`w-full flex items-center gap-4 text-sm font-bold tracking-widest uppercase transition-all text-left cursor-pointer group ${
              currentTab === 'discover'
                ? 'text-white'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                currentTab === 'discover' ? 'bg-[#E85D2A]' : 'bg-transparent'
              }`}
            />
            <span>Discover</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('likes')}
            className={`w-full flex items-center justify-between text-sm font-bold tracking-widest uppercase transition-all text-left cursor-pointer group ${
              currentTab === 'likes'
                ? 'text-white'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-4">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  currentTab === 'likes' ? 'bg-[#E85D2A]' : 'bg-transparent'
                }`}
              />
              <span>Likes</span>
            </div>
            {incomingLikes.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#E85D2A] text-white text-[10px] font-bold">
                {incomingLikes.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('matches')}
            className={`w-full flex items-center justify-between text-sm font-bold tracking-widest uppercase transition-all text-left cursor-pointer group ${
              currentTab === 'matches'
                ? 'text-white'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-4">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  currentTab === 'matches' ? 'bg-[#E85D2A]' : 'bg-transparent'
                }`}
              />
              <span>Matches</span>
            </div>
            {matches.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold">
                {matches.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('profile')}
            className={`w-full flex items-center gap-4 text-sm font-bold tracking-widest uppercase transition-all text-left cursor-pointer group ${
              currentTab === 'profile'
                ? 'text-white'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                currentTab === 'profile' ? 'bg-[#E85D2A]' : 'bg-transparent'
              }`}
            />
            <span>Profile</span>
          </button>
        </nav>

        {/* User Account / Safety & Support Links */}
        <div className="space-y-6 pt-6 border-t border-white/10">
          {/* Active User / Guest Pill */}
          {currentUser ? (
            <div
              onClick={() => setCurrentTab('profile')}
              className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-stone-700 shrink-0 border border-white/10">
                <img
                  src={
                    currentUser.photos[0] ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
                  }
                  alt={currentUser.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                <p className="text-[10px] text-white/50 truncate">{currentUser.location}</p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-[#E85D2A] hover:bg-[#d44f1f] text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
            >
              <User size={15} />
              <span>Log In / Profile</span>
            </button>
          )}

          <div>
            <h4 className="text-[10px] uppercase tracking-widest opacity-40 mb-2 font-bold">
              Safety & Trust
            </h4>
            <button
              type="button"
              onClick={() => setLegalModal({ isOpen: true, type: 'safety' })}
              className="block text-xs text-stone-400 hover:text-white transition-colors cursor-pointer py-0.5"
            >
              Safety Center
            </button>
            <button
              type="button"
              onClick={() => setLegalModal({ isOpen: true, type: 'guidelines' })}
              className="block text-xs text-stone-400 hover:text-white transition-colors cursor-pointer py-0.5"
            >
              Dating Guidelines
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="block text-xs text-stone-400 hover:text-white transition-colors cursor-pointer py-0.5"
              >
                Settings & Privacy
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Feed Area */}
      <main className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden relative" role="main">
        {/* Header with Profile Login Icon at top */}
        <Header
          currentTab={currentTab}
          currentUser={currentUser}
          onOpenFilter={() => setIsFilterOpen(true)}
          hasActiveFilters={hasActiveFilters}
          onOpenSafety={() => setLegalModal({ isOpen: true, type: 'safety' })}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />

        {/* Tab View Container */}
        <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col">
          {/* DISCOVER TAB */}
          {currentTab === 'discover' && (
            <section aria-label="Discover Section" className="flex-1 flex flex-col justify-center items-center p-4 md:p-8">
              {isLoadingDiscover ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-3 min-h-[60vh]">
                  <div className="w-8 h-8 border-2 border-[#E85D2A] border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-semibold text-[#7A766E]">
                    Finding people...
                  </p>
                </div>
              ) : currentDiscoverProfile ? (
                <div className="w-full max-w-lg flex flex-col justify-center my-auto">
                  <ProfileCard
                    profile={currentDiscoverProfile}
                    onLike={() => handleLike(currentDiscoverProfile)}
                    onPass={() => handlePass(currentDiscoverProfile)}
                    onOpenDetail={() => setDetailProfile(currentDiscoverProfile)}
                    onReport={() => setReportTarget(currentDiscoverProfile)}
                    isAnimating={cardAnimation}
                  />
                </div>
              ) : (
                /* Authentic Clean State when no more profiles exist in feed */
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 min-h-[60vh]">
                  <div className="w-16 h-16 rounded-2xl bg-[#FAF8F4] border border-[#D9D6CF] flex items-center justify-center text-[#E85D2A] shadow-xs">
                    <ArrowRight size={28} strokeWidth={2} />
                  </div>
                  <div className="space-y-1.5 max-w-xs">
                    <h3 className="text-2xl font-black tracking-tight text-[#111111]">
                      Ready to Discover.
                    </h3>
                    <p className="text-xs text-[#7A766E] leading-relaxed">
                      {currentUser
                        ? "You've reviewed all available profiles matching your preferences."
                        : "You're exploring ARROW in guest mode. Log in or create a profile to start sending Arrows and connecting."}
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col gap-2 w-full max-w-xs">
                    {!currentUser ? (
                      <Button
                        variant="primary"
                        fullWidth
                        onClick={() => setIsAuthModalOpen(true)}
                        icon={<UserPlus size={15} />}
                        arrow="right"
                      >
                        Log In or Create Profile
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="primary"
                          fullWidth
                          onClick={() => setIsFilterOpen(true)}
                          icon={<SlidersHorizontal size={15} />}
                          arrow="right"
                        >
                          Adjust Preferences
                        </Button>

                        <Button
                          variant="ghost"
                          fullWidth
                          onClick={() => {
                            refreshAppData();
                            showToast('Feed refreshed', 'info');
                          }}
                          icon={<RefreshCw size={15} />}
                        >
                          Check for New People
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* LIKES TAB */}
          {currentTab === 'likes' && (
            <section aria-label="Likes Section" className="max-w-2xl w-full mx-auto p-4 md:p-6">
              <LikesList
                likes={incomingLikes}
                isGuest={!currentUser}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                onLikeBack={handleLikeBackFromLikes}
                onPass={handlePassFromLikes}
                onViewProfile={(profile) => setDetailProfile(profile)}
                onReport={(profile) => setReportTarget(profile)}
                onGoToDiscover={() => setCurrentTab('discover')}
              />
            </section>
          )}

          {/* MATCHES TAB */}
          {currentTab === 'matches' && (
            <section aria-label="Matches Section" className="max-w-2xl w-full mx-auto p-4 md:p-6">
              <MatchesList
                matches={matches}
                isGuest={!currentUser}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                onSelectMatch={(match) => setSelectedMatch(match)}
                onGoToDiscover={() => setCurrentTab('discover')}
              />
            </section>
          )}

          {/* PROFILE TAB */}
          {currentTab === 'profile' && (
            <section aria-label="User Profile Section" className="max-w-xl w-full mx-auto p-4 md:p-6">
              <ProfileView
                currentUser={currentUser}
                onEditProfile={() => setIsEditProfileOpen(true)}
                onEditPhotos={() => setIsEditPhotosOpen(true)}
                onEditPreferences={() => setIsPreferencesOpen(true)}
                onEditWhatsApp={() => setIsWhatsAppOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenAuth={() => setIsAuthModalOpen(true)}
              />
            </section>
          )}
        </div>

        {/* Mobile Bottom Navigation */}
        <BottomNav
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab)}
          likesCount={incomingLikes.length}
          matchesCount={matches.length}
        />
      </main>

      {/* Right Activity & Connection Sidebar (Desktop Professional Polish) */}
      <aside className="hidden xl:flex w-80 bg-white border-l border-[#D9D6CF] flex-col shrink-0 overflow-y-auto">
        {/* Activity Section */}
        <div className="p-7 border-b border-[#D9D6CF]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#111111]/50">
              Activity & Matches
            </h3>
            <span className="text-[11px] font-bold text-[#E85D2A]">
              {matches.length + incomingLikes.length} Total
            </span>
          </div>

          {matches.length > 0 || incomingLikes.length > 0 ? (
            <div className="space-y-3">
              {matches.slice(0, 3).map((m) => (
                <div
                  key={m.id}
                  onClick={() => setSelectedMatch(m)}
                  className="flex items-center gap-3 p-2 rounded-2xl hover:bg-[#FAF8F4] transition-colors cursor-pointer border border-transparent hover:border-[#D9D6CF]"
                >
                  <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 ring-2 ring-[#E85D2A] ring-offset-2">
                    <img
                      src={
                        m.partnerProfile.photos[0] ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
                      }
                      alt={m.partnerProfile.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between">
                      <p className="text-xs font-bold text-[#111111] truncate">{m.partnerProfile.name}</p>
                      <span className="text-[10px] font-bold text-[#17352F] uppercase">Match</span>
                    </div>
                    <p className="text-[11px] text-[#7A766E] truncate">{m.partnerProfile.location}</p>
                  </div>
                </div>
              ))}

              {incomingLikes.slice(0, 2).map((l) => (
                <div
                  key={l.profile.id}
                  onClick={() => {
                    setDetailProfile(l.profile);
                  }}
                  className="flex items-center gap-3 p-2 rounded-2xl hover:bg-[#FAF8F4] transition-colors cursor-pointer"
                >
                  <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 border border-[#D9D6CF]">
                    <img
                      src={
                        l.profile.photos[0] ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
                      }
                      alt={l.profile.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between">
                      <p className="text-xs font-bold text-[#111111] truncate">{l.profile.name}</p>
                      <span className="text-[10px] font-bold text-[#E85D2A] uppercase">Liked You</span>
                    </div>
                    <p className="text-[11px] text-[#7A766E] truncate">{l.profile.lookingFor || 'Seeking Connection'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 px-2 space-y-1">
              <p className="text-xs font-semibold text-[#111111]">
                {currentUser ? 'No recent activity' : 'Guest Mode'}
              </p>
              <p className="text-[11px] text-[#7A766E]">
                {currentUser
                  ? 'Likes and matches will appear here in real-time.'
                  : 'Log in to view incoming likes and active connections.'}
              </p>
            </div>
          )}
        </div>

        {/* Direct Connection (WhatsApp) Section */}
        <div className="flex-1 p-7 bg-[#F5F3EE]/30 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#111111]/50">
              Direct Connection
            </h3>

            <div className="p-5 bg-white rounded-3xl border border-[#D9D6CF] shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-2xl flex items-center justify-center text-[#25D366] border border-green-100">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#111111]">Permission-Based</h4>
                  <p className="text-[10px] text-[#7A766E]">WhatsApp Integration</p>
                </div>
              </div>
              <p className="text-[11px] text-[#7A766E] leading-relaxed">
                Connect directly on WhatsApp only after mutual interest. Your phone number is never displayed publicly.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (currentUser) {
                    setIsWhatsAppOpen(true);
                  } else {
                    setIsAuthModalOpen(true);
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl border border-[#111111] bg-transparent text-[#111111] hover:bg-[#111111] hover:text-[#F5F3EE] font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>
                  {currentUser
                    ? currentUser.allowWhatsApp
                      ? 'Manage WhatsApp'
                      : 'Enable WhatsApp'
                    : 'Log In to Enable'}
                </span>
                <span className="font-mono">→</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#EAF1EF] border border-[#C5DCD6] text-[11px] text-[#17352F] font-medium space-y-1">
            <p className="font-bold">Human Verified & Protected</p>
            <p className="text-[#17352F]/80 text-[10px]">
              ARROW enforces strict anti-harassment safety checks across all interactions.
            </p>
          </div>
        </div>
      </aside>

      {/* --- ALL MODALS & SHEETS --- */}

      {/* Auth & Profile Login Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onSelectProfile={(profile) => {
          storageService.setCurrentUserId(profile.id);
          setCurrentUser(profile);
          setIsAuthModalOpen(false);
          showToast(`Logged in as ${profile.name}`, 'success');
        }}
        onStartOnboarding={() => {
          setIsAuthModalOpen(false);
          setIsOnboarding(true);
        }}
        onLogOut={() => {
          handleLogOut();
          setIsAuthModalOpen(false);
        }}
      />

      {/* Onboarding Flow Full Overlay */}
      {isOnboarding && (
        <div className="fixed inset-0 z-50 bg-[#F5F3EE] flex flex-col justify-center overflow-y-auto">
          <OnboardingFlow
            onComplete={handleOnboardingComplete}
            onCancel={() => setIsOnboarding(false)}
          />
        </div>
      )}

      {/* Full Profile Detail View */}
      <ProfileDetailModal
        profile={detailProfile}
        isOpen={Boolean(detailProfile)}
        onClose={() => setDetailProfile(null)}
        onLike={() => {
          if (detailProfile) handleLike(detailProfile);
        }}
        onPass={() => {
          if (detailProfile) handlePass(detailProfile);
        }}
        onReport={() => {
          if (detailProfile) {
            setReportTarget(detailProfile);
          }
        }}
      />

      {/* Match Celebration */}
      <MatchCelebrationModal
        currentUser={currentUser || {
          id: 'guest',
          name: 'You',
          dateOfBirth: '2000-01-01',
          age: 25,
          gender: 'non-binary',
          location: '',
          bio: '',
          photos: [],
          interests: [],
          lookingFor: 'Meaningful dating',
          prompts: [],
          isVerifiedAdult: true,
          allowWhatsApp: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }}
        matchedProfile={matchCelebration.partnerProfile}
        matchRecord={matchCelebration.matchRecord}
        isOpen={matchCelebration.isOpen}
        onClose={() =>
          setMatchCelebration({ isOpen: false, partnerProfile: null })
        }
        onContinueDiscover={() => {
          setMatchCelebration({ isOpen: false, partnerProfile: null });
          setCurrentTab('discover');
        }}
      />

      {/* Match Detail View */}
      <MatchDetailModal
        matchItem={selectedMatch}
        isOpen={Boolean(selectedMatch)}
        onClose={() => setSelectedMatch(null)}
        onUnmatch={handleUnmatch}
        onReport={(profile) => setReportTarget(profile)}
      />

      {/* Filters Bottom Sheet */}
      <FilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onApplyFilters={(newFilters) => {
          setFilters(newFilters);
          showToast('Filters applied', 'info');
        }}
        onResetFilters={() => {
          setFilters({
            ageMin: 18,
            ageMax: 60,
            genders: ['everyone'],
            location: '',
            interests: [],
            lookingFor: [],
          });
          showToast('Filters reset to default', 'info');
        }}
      />

      {/* Edit Profile Modal */}
      {currentUser && (
        <EditProfileModal
          currentUser={currentUser}
          isOpen={isEditProfileOpen}
          onClose={() => setIsEditProfileOpen(false)}
          onSave={handleUpdateProfile}
        />
      )}

      {/* Edit Photos Modal */}
      {currentUser && (
        <EditPhotosModal
          currentUser={currentUser}
          isOpen={isEditPhotosOpen}
          onClose={() => setIsEditPhotosOpen(false)}
          onUpdatePhotos={handleUpdatePhotos}
        />
      )}

      {/* Dating Preferences Modal */}
      {currentUser && (
        <PreferencesModal
          preferences={storageService.getPreferences(currentUser.id)}
          isOpen={isPreferencesOpen}
          onClose={() => setIsPreferencesOpen(false)}
          onSave={handleUpdatePreferences}
        />
      )}

      {/* WhatsApp Connection Modal */}
      {currentUser && (
        <WhatsAppModal
          currentUser={currentUser}
          isOpen={isWhatsAppOpen}
          onClose={() => setIsWhatsAppOpen(false)}
          onSave={handleUpdateWhatsApp}
        />
      )}

      {/* Settings & Privacy Modal */}
      {currentUser && (
        <SettingsModal
          currentUser={currentUser}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onOpenEditProfile={() => setIsEditProfileOpen(true)}
          onOpenPreferences={() => setIsPreferencesOpen(true)}
          onOpenWhatsApp={() => setIsWhatsAppOpen(true)}
          onOpenLegal={(type) => setLegalModal({ isOpen: true, type })}
          onLogOut={handleLogOut}
          onDeleteAccount={handleDeleteAccount}
          onSwitchProfile={handleSwitchProfile}
          onNewProfile={() => {
            setIsSettingsOpen(false);
            setIsOnboarding(true);
          }}
        />
      )}

      {/* Report & Block User Modal */}
      <ReportModal
        reportedUser={reportTarget}
        isOpen={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        onSubmitReport={handleSubmitReport}
      />

      {/* Legal & Safety Guidelines Modal */}
      <LegalModal
        type={legalModal.type}
        isOpen={legalModal.isOpen}
        onClose={() => setLegalModal({ isOpen: false, type: null })}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ArrowApp />
    </ToastProvider>
  );
}
