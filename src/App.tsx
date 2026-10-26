import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  UserProfile,
  TabType,
  FilterState,
  MatchRecord,
  MatchWithProfile,
  LikeEntry,
  LikeQuota,
  ReportReason,
  DatingPreferences,
  PlanInfo,
  PaymentMethod,
  HistoryEntry,
} from './types';
import { FREE_PLAN } from './services/billingService';
import { isUpgradeError } from './services/rpc';
import { UpgradeReason } from './config/plans';
import { PlansModal } from './components/premium/PlansModal';
import { SuperArrowModal } from './components/discover/SuperArrowModal';
import { Logo, CreatedByEden } from './components/brand/Logo';
import { storageService } from './services/storageService';
import { api, authService, profileService } from './services/api';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { ProfileCard } from './components/discover/ProfileCard';
import { ProfileDetailModal } from './components/discover/ProfileDetailModal';
import { MatchCelebrationModal } from './components/discover/MatchCelebrationModal';
import { FilterModal } from './components/discover/FilterModal';
import { LikesList } from './components/likes/LikesList';
import { MatchesList } from './components/matches/MatchesList';
import { HistoryList } from './components/history/HistoryList';
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
import { NewPasswordModal } from './components/auth/NewPasswordModal';
import { ToastProvider, useToast } from './components/ui/Toast';
import { Button } from './components/ui/Button';
import { Avatar } from './components/ui/Avatar';
import {
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  UserPlus,
  User,
  Rocket,
  Zap,
  Crown,
  RotateCcw,
  Send,
} from 'lucide-react';

function ArrowApp() {
  const { showToast } = useToast();

  // App Navigation & Current User State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentTab, setCurrentTab] = useState<TabType>('discover');
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isNewPasswordOpen, setIsNewPasswordOpen] = useState(false);

  // Discover State
  const [discoverProfiles, setDiscoverProfiles] = useState<UserProfile[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [cardAnimation, setCardAnimation] = useState<'like' | 'pass' | 'super' | null>(null);
  const [isLoadingDiscover, setIsLoadingDiscover] = useState(true);

  // Likes & Matches State
  const [incomingLikes, setIncomingLikes] = useState<LikeEntry[]>([]);
  // Arrows you sent that have not been answered yet.
  const [sentLikes, setSentLikes] = useState<LikeEntry[]>([]);
  // Everyone you have swiped on, for the History tab.
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  // Likes the server counted but, on the free plan, did not identify.
  const [hiddenLikes, setHiddenLikes] = useState(0);
  const [matches, setMatches] = useState<MatchWithProfile[]>([]);
  const [quota, setQuota] = useState<LikeQuota | null>(null);

  // Membership. FREE_PLAN until the server says otherwise; every feature it
  // unlocks is also enforced by the database, so this only drives the UI.
  const [planInfo, setPlanInfo] = useState<PlanInfo>(FREE_PLAN);
  const [plansReason, setPlansReason] = useState<UpgradeReason | null>(null);
  const [superTarget, setSuperTarget] = useState<UserProfile | null>(null);

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
  const [selectedMatch, setSelectedMatch] = useState<MatchWithProfile | null>(null);
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

  // Track previous user to detect login changes for match notifications
  const [prevUserId, setPrevUserId] = useState<string | null>(null);

  // 1. Initialize Supabase Auth & Session Restoration
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      if (isSupabaseConfigured) {
        try {
          const session = await authService.getSession();
          if (session?.user && mounted) {
            const profile = await profileService.getMyProfile();
            if (profile?.isVerifiedAdult && mounted) {
              setCurrentUser(profile);
              setPrevUserId(profile.id);
              await authService.updateLastLogin();
            } else if (mounted) {
              // Signed in but never finished setting up (for example they
              // closed the tab mid-onboarding): pick up where they left off.
              setIsOnboarding(true);
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
            setPrevUserId(user.id);
          }
        }
      }
    }

    initSession();

    // Listen to Supabase Auth State changes
    const { unsubscribe } = authService.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await profileService.getMyProfile().catch(() => null);
        if (profile?.isVerifiedAdult && mounted) {
          setCurrentUser(profile);
          setIsAuthModalOpen(false);
          await authService.updateLastLogin();

          // Presence is surfaced from the matches payload after the first
          // refresh, so nothing extra is fetched here.
          setPrevUserId(profile.id);
        } else if (mounted) {
          // A brand-new account (including one that just came back from
          // Google) goes straight into setup instead of being left signed in
          // with nothing to show.
          setIsAuthModalOpen(false);
          setIsOnboarding(true);
        }
      } else if (event === 'PASSWORD_RECOVERY') {
        // The reset link already signed this person in, so the only thing left
        // is choosing the new password.
        if (mounted) setIsNewPasswordOpen(true);
      } else if (event === 'SIGNED_OUT') {
        if (mounted) {
          setPrevUserId(currentUser?.id || null);
          setCurrentUser(null);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [prevUserId, currentUser?.id]);

  /**
   * Tell the user which matches have been around recently.
   *
   * This used to query arrow_profiles directly for every match's last_login_at,
   * which both relied on reading other people's rows and ignored whether they
   * wanted their activity shown. The matches payload now carries lastActiveAt
   * already, and the server nulls it for anyone who turned presence off.
   */
  const announceActiveMatches = (records: MatchWithProfile[]) => {
    const sinceMs = Date.now() - 24 * 60 * 60 * 1000;
    const active = records.filter((m) => {
      const seen = m.partnerProfile.lastActiveAt;
      return seen ? new Date(seen).getTime() > sinceMs : false;
    });

    if (active.length === 0) return;

    const names = active.slice(0, 3).map((m) => m.partnerProfile.name);
    const rest = active.length - names.length;
    const list = names.join(', ');

    showToast(
      rest > 0
        ? `${list} and ${rest} more have been active today`
        : `${list} ${names.length === 1 ? 'has' : 'have'} been active today`,
      'info'
    );
  };

  // 2. Refresh Feed, Likes & Matches data whenever currentUser or filters change
  const refreshAppData = useCallback(async () => {
    // Every server read needs a signed-in user, so a logged-out visitor on a
    // connected build has nothing to fetch — asking anyway only returns 401s.
    if (isSupabaseConfigured && !currentUser) {
      setDiscoverProfiles([]);
      setIncomingLikes([]);
      setSentLikes([]);
      setHistory([]);
      setHiddenLikes(0);
      setMatches([]);
      setQuota(null);
      setPlanInfo(FREE_PLAN);
      setIsLoadingDiscover(false);
      return;
    }

    setIsLoadingDiscover(true);
    try {
      const [feed, likesData, matchesData, quotaData, plan, sent, past] = await Promise.all([
        api.getDiscoverProfiles(filters),
        api.getLikes(),
        api.getMatches(),
        api.getLikeQuota(),
        currentUser ? api.getMyPlan() : Promise.resolve(FREE_PLAN),
        api.getSentLikes(),
        api.getHistory(),
      ]);
      setHistory(past);
      setDiscoverProfiles(feed);
      setCardIndex(0);
      setIncomingLikes(likesData.entries);
      setSentLikes(sent);
      setHiddenLikes(likesData.hiddenCount);
      setMatches(matchesData);
      setQuota(quotaData);
      setPlanInfo(plan);
    } catch (err) {
      console.error('Failed to load ARROW app data', err);
    } finally {
      setIsLoadingDiscover(false);
    }
  }, [currentUser, filters]);

  useEffect(() => {
    refreshAppData();
  }, [refreshAppData]);

  // Swiping does not trigger a full refresh, so History reloads each time it
  // is opened to include the swipes made since.
  useEffect(() => {
    if (currentTab === 'history' && currentUser) {
      api.getHistory().then(setHistory);
    }
  }, [currentTab, currentUser]);

  /** Matches and likes only, without reshuffling the discovery deck. */
  const refreshInbox = useCallback(async () => {
    const [likesData, matchesData, sent] = await Promise.all([
      api.getLikes(),
      api.getMatches(),
      api.getSentLikes(),
    ]);
    setIncomingLikes(likesData.entries);
    setSentLikes(sent);
    setHiddenLikes(likesData.hiddenCount);
    setMatches(matchesData);
  }, []);

  const refreshPlan = useCallback(async () => {
    const [plan, quotaData] = await Promise.all([api.getMyPlan(), api.getLikeQuota()]);
    setPlanInfo(plan);
    setQuota(quotaData);
    return plan;
  }, []);

  // New messages anywhere: keep the unread badges live, and say who wrote
  // unless that conversation is already open.
  const selectedMatchRef = useRef<string | null>(null);
  selectedMatchRef.current = selectedMatch?.id ?? null;
  const matchesRef = useRef<MatchWithProfile[]>([]);
  matchesRef.current = matches;

  useEffect(() => {
    if (!currentUser) return;
    return api.subscribeToInbox(currentUser.id, (message) => {
      if (message.matchId !== selectedMatchRef.current) {
        const from = matchesRef.current.find((m) => m.id === message.matchId)?.partnerProfile.name;
        showToast(from ? `New message from ${from}` : 'You have a new message', 'info');
      }
      refreshInbox();
    });
    // showToast is stable for the provider's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, refreshInbox]);

  // A shareable link straight to pricing: /#pricing or /?plans
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (window.location.hash === '#pricing' || params.has('plans')) setPlansReason('browse');
  }, []);

  // Coming back from Paystack's checkout or card-update page.
  useEffect(() => {
    if (!currentUser) return;
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('membership');
    if (!outcome) return;

    params.delete('membership');
    const query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''));

    if (outcome === 'success') {
      // The webhook usually lands within a second or two; look again shortly
      // in case the browser got back first.
      showToast('Payment received — switching on your membership…', 'success');
      refreshPlan().then((plan) => {
        if (plan.plan === 'free') window.setTimeout(refreshPlan, 4000);
      });
    } else if (outcome === 'returned') {
      refreshPlan();
    } else if (outcome === 'cancelled') {
      showToast('Payment cancelled — nothing was charged.', 'info');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const openPlans = (reason: UpgradeReason = 'browse') => setPlansReason(reason);

  /** Called by the sign-in sheet once Supabase has a session. */
  const handleAuthenticated = async () => {
    setIsAuthModalOpen(false);
    const profile = await profileService.getMyProfile().catch(() => null);
    if (profile?.isVerifiedAdult) {
      setCurrentUser(profile);
      showToast(`Welcome back, ${profile.name}`, 'success');
    } else {
      setIsOnboarding(true);
    }
  };

  const unreadTotal = matches.reduce((sum, m) => sum + (m.unreadCount || 0), 0);

  // Discovery Actions
  const handleLike = async (targetProfile: UserProfile, isSuper = false, note?: string) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      showToast(`Log in or create a profile to send an Arrow to ${targetProfile.name}`, 'info');
      return;
    }

    if (isSuper && quota && quota.superRemaining <= 0) {
      openPlans('arrows');
      return;
    }

    // On Plus, a super arrow can carry a note: ask for it first.
    if (isSuper && note === undefined && planInfo.features.arrowNotes) {
      setSuperTarget(targetProfile);
      return;
    }

    setCardAnimation(isSuper ? 'super' : 'like');
    try {
      const result = await api.likeProfile(targetProfile.id, isSuper, note);
      if (result.quota) setQuota(result.quota);

      setTimeout(() => {
        setCardAnimation(null);
        setCardIndex((prev) => prev + 1);

        if (result.isMatch) {
          setMatchCelebration({
            isOpen: true,
            partnerProfile: result.partner || targetProfile,
            matchRecord: result.match,
          });
          refreshAppData();
        }
      }, 250);
    } catch (err: any) {
      setCardAnimation(null);
      if (isUpgradeError(err)) {
        openPlans(isSuper ? 'arrows' : planInfo.plan === 'free' ? 'arrows' : 'browse');
        showToast(err.message, 'info');
      } else {
        showToast(err.message || 'Could not send that arrow', 'error');
      }
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
      await api.passProfile(targetProfile.id);
      setTimeout(() => {
        setCardAnimation(null);
        setCardIndex((prev) => prev + 1);
      }, 250);
    } catch (err) {
      setCardAnimation(null);
      console.error(err);
    }
  };

  /** Undo the last swipe and put that person back at the front of the deck. */
  const handleRewind = async () => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const result = await api.rewindLastSwipe();

      if (!result.success) {
        showToast(result.error || 'Nothing to undo', 'info');
        return;
      }

      if (result.profile) {
        const recovered = result.profile;
        setDiscoverProfiles((prev) => {
          const rest = prev.filter((p) => p.id !== recovered.id);
          const head = rest.slice(0, cardIndex);
          const tail = rest.slice(cardIndex);
          return [...head, recovered, ...tail];
        });
        showToast(`${result.profile.name} is back in your deck`, 'success');
      }

      const refreshedQuota = await api.getLikeQuota();
      setQuota(refreshedQuota);
    } catch (err: any) {
      if (isUpgradeError(err)) {
        openPlans('rewind');
      } else {
        showToast(err.message || 'Could not undo that', 'error');
      }
    }
  };

  /** Take back an arrow that has not been answered yet. */
  const handleUnsend = async (profile: UserProfile) => {
    try {
      const result = await api.unsendArrow(profile.id);
      if (!result.success) {
        showToast(result.error || 'Could not take that arrow back', 'info');
        return;
      }
      showToast(`Arrow to ${profile.name} taken back`, 'info');
      setDetailProfile(null);
      await refreshInbox();
      setHistory(await api.getHistory());
      setQuota(await api.getLikeQuota());
    } catch (err: any) {
      showToast(err.message || 'Could not take that arrow back', 'error');
    }
  };

  /** Bring back everyone you passed on, straight into the deck. */
  const handleClearPasses = async () => {
    try {
      const restored = await api.clearPasses();
      await refreshAppData();
      showToast(
        restored > 0
          ? `${restored} ${restored === 1 ? 'person is' : 'people are'} back in your deck`
          : "You haven't passed on anyone — you've seen everyone for now",
        'info'
      );
    } catch (err: any) {
      showToast(err.message || 'Could not bring them back', 'error');
    }
  };

  const handleBoost = async () => {
    if (!planInfo.features.boost) {
      openPlans('boost');
      return;
    }
    try {
      setPlanInfo(await api.startBoost());
      showToast("You're boosted for the next 30 minutes", 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not start a boost', 'error');
    }
  };

  // Membership actions --------------------------------------------------------
  const handleStartTrial = async () => {
    try {
      setPlanInfo(await api.startTrial());
      setPlansReason(null);
      showToast('Your Plus trial has started. Enjoy!', 'success');
      refreshAppData();
    } catch (err: any) {
      showToast(err.message || 'Could not start your trial', 'error');
    }
  };

  const handleChoosePlan = async (plan: 'plus' | 'premium', method: PaymentMethod) => {
    try {
      // Leaves the app for Paystack's checkout page; returns only if that fails.
      await api.startCheckout(plan, method);
    } catch (err: any) {
      showToast(err.message || 'Could not open the payment page', 'error');
    }
  };

  const handleCancelRenewal = async () => {
    try {
      await api.cancelRenewal();
      const plan = await refreshPlan();
      showToast(
        plan.currentPeriodEnd
          ? `Renewal cancelled. You keep your plan until ${new Date(plan.currentPeriodEnd).toLocaleDateString()}.`
          : 'Renewal cancelled.',
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Could not cancel renewal', 'error');
    }
  };

  const handleManageBilling = async () => {
    try {
      await api.openBillingPortal();
    } catch (err: any) {
      showToast(err.message || 'Could not open billing', 'error');
    }
  };

  const handleToggleIncognito = async (enabled: boolean) => {
    try {
      const updated = await api.setIncognito(enabled);
      if (updated) setCurrentUser(updated);
      showToast(enabled ? 'Incognito on — only people you like can see you' : 'Incognito off', 'info');
    } catch (err: any) {
      if (isUpgradeError(err)) openPlans('incognito');
      else showToast(err.message || 'Could not change incognito', 'error');
    }
  };

  // Likes Tab Actions
  const handleLikeBackFromLikes = async (targetProfile: UserProfile) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    try {
      const result = await api.likeProfile(targetProfile.id);
      if (result.quota) setQuota(result.quota);

      if (result.isMatch) {
        setMatchCelebration({
          isOpen: true,
          partnerProfile: result.partner || targetProfile,
          matchRecord: result.match,
        });
      }
      showToast(`Connected with ${targetProfile.name}!`, 'success');
      refreshAppData();
    } catch (err: any) {
      if (isUpgradeError(err)) openPlans('arrows');
      else showToast(err.message || 'Could not send that arrow', 'error');
    }
  };

  const handlePassFromLikes = async (targetProfile: UserProfile) => {
    if (!currentUser) return;
    try {
      await api.passProfile(targetProfile.id);
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
      await api.unmatchUser(matchId);
      showToast(`Unmatched with ${partnerName}`, 'info');
      setSelectedMatch(null);
      refreshAppData();
    } catch (err) {
      showToast('Failed to unmatch', 'error');
    }
  };

  // Safety: Report & Block
  const handleSubmitReport = async (reason: ReportReason, details: string) => {
    if (!currentUser || !reportTarget) return;
    try {
      // One call files the report and blocks in the same transaction, so the
      // person is gone the moment the report lands.
      await api.reportUser(reportTarget.id, reason, details, true);
      showToast(`Report received. ${reportTarget.name} has been blocked.`, 'info');
      setReportTarget(null);
      setDetailProfile(null);
      setSelectedMatch(null);
      refreshAppData();
    } catch (err: any) {
      showToast(err.message || 'Failed to submit report', 'error');
    }
  };

  const handleBlockUser = async (target: UserProfile) => {
    if (!currentUser) return;
    try {
      await api.blockUser(target.id);
      showToast(`${target.name} has been blocked`, 'info');
      setDetailProfile(null);
      setSelectedMatch(null);
      refreshAppData();
    } catch (err: any) {
      showToast(err.message || 'Failed to block', 'error');
    }
  };

  // Profile Updates
  const handleUpdateProfile = async (updatedData: Partial<UserProfile>) => {
    if (!currentUser) return;
    const updated = await api.updateProfile(updatedData);
    setCurrentUser(updated);
    showToast('Profile updated', 'success');
  };

  /**
   * Uploads are saved as they finish; this applies removals and the new order,
   * then reloads so the profile reflects what the server actually stored.
   */
  const handleUpdatePhotos = async (keptRefs: string[], removedRefs: string[]) => {
    if (!currentUser) return;
    await api.savePhotoChanges(keptRefs, removedRefs);
    const refreshed = await api.getMyProfile();
    if (refreshed) setCurrentUser(refreshed);
  };

  const handleUpdatePreferences = async (prefs: DatingPreferences) => {
    if (!currentUser) return;
    await api.updatePreferences(prefs);
    showToast('Preferences saved', 'success');
    refreshAppData();
  };

  const handleUpdateWhatsApp = async (allowWhatsApp: boolean, whatsappNumber: string) => {
    if (!currentUser) return;
    const updated = await api.setWhatsApp(allowWhatsApp, whatsappNumber);
    setCurrentUser(updated);
    showToast(
      allowWhatsApp
        ? 'Your number will be shared with matches only'
        : 'Your number is no longer shared',
      'success'
    );
  };

  /** Pause hides you from discovery without losing matches or conversations. */
  const handleTogglePause = async (isPaused: boolean) => {
    if (!currentUser) return;
    const updated = await api.setVisibility(isPaused);
    if (updated) setCurrentUser(updated);
    showToast(isPaused ? 'Your profile is hidden from discovery' : 'You are visible again', 'info');
  };

  const handleToggleOnlineStatus = async (show: boolean) => {
    if (!currentUser) return;
    const updated = await api.setVisibility(Boolean(currentUser.isPaused), show);
    if (updated) setCurrentUser(updated);
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
    setPlanInfo(FREE_PLAN);
    setMatches([]);
    setIncomingLikes([]);
    setHiddenLikes(0);
    showToast('You have logged out', 'info');
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    await api.deleteAccount();
    setCurrentUser(null);
    setPlanInfo(FREE_PLAN);
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
    refreshAppData();
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
    <div className="app-shell flex w-full bg-[var(--color-offwhite)] font-sans text-[var(--color-ink)] overflow-hidden">
      {/* Left Navigation Sidebar for Desktop (Professional Polish Theme) */}
      <aside className="hidden lg:flex w-72 bg-[var(--color-rail)] text-[var(--color-rail-ink)] flex-col justify-between py-10 px-8 shrink-0 z-20">
        {/* Brand Header */}
        <div className="space-y-2">
          <Logo size="md" inverted />
          <p className="text-[10px] text-white/40 tracking-widest uppercase font-medium">
            Dating with intention
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
                currentTab === 'discover' ? 'bg-[var(--color-arrow-orange)]' : 'bg-transparent'
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
                  currentTab === 'likes' ? 'bg-[var(--color-arrow-orange)]' : 'bg-transparent'
                }`}
              />
              <span>Likes</span>
            </div>
            {incomingLikes.length + hiddenLikes > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[var(--color-arrow-orange)] text-white text-[10px] font-bold">
                {incomingLikes.length + hiddenLikes}
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
                  currentTab === 'matches' ? 'bg-[var(--color-arrow-orange)]' : 'bg-transparent'
                }`}
              />
              <span>Chats</span>
            </div>
            {unreadTotal > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-[var(--color-arrow-orange)] text-white text-[10px] font-bold">
                {unreadTotal}
              </span>
            ) : matches.length > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold">
                {matches.length}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('history')}
            className={`w-full flex items-center gap-4 text-sm font-bold tracking-widest uppercase transition-all text-left cursor-pointer group ${
              currentTab === 'history'
                ? 'text-white'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                currentTab === 'history' ? 'bg-[var(--color-arrow-orange)]' : 'bg-transparent'
              }`}
            />
            <span>History</span>
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
                currentTab === 'profile' ? 'bg-[var(--color-arrow-orange)]' : 'bg-transparent'
              }`}
            />
            <span>Profile</span>
          </button>
        </nav>

        {/* User Account / Safety & Support Links */}
        <div className="space-y-6 pt-6 border-t border-white/10">
          {planInfo.plan === 'free' && (
            <button
              type="button"
              onClick={() => openPlans('browse')}
              className="w-full text-left p-4 rounded-2xl bg-gradient-to-br from-[var(--color-arrow-orange)] to-[#c43d1f] text-white space-y-1 hover:brightness-110 transition-all"
            >
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest opacity-90">
                <Zap size={12} /> ARROW Plus
              </span>
              <span className="block text-sm font-black leading-tight">
                {!currentUser || planInfo.trialAvailable ? `Try it free for ${planInfo.trialDays} days` : 'See who likes you'}
              </span>
              <span className="block text-[11px] opacity-85">From KES 499/month · M-Pesa or card</span>
            </button>
          )}
          {currentUser && planInfo.plan !== 'free' && (
            <button
              type="button"
              onClick={() => openPlans('browse')}
              className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[var(--color-gold-fill)]"
            >
              <Crown size={13} /> {planInfo.plan} member
            </button>
          )}

          {/* Active User / Guest Pill */}
          {currentUser ? (
            <div
              onClick={() => setCurrentTab('profile')}
              className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Avatar
                name={currentUser.name}
                src={currentUser.photos[0]}
                size="sm"
                className="w-10 h-10 border-white/10"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                <p className="text-[10px] text-white/50 truncate">{currentUser.location}</p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-[var(--color-arrow-orange)] hover:bg-[var(--color-arrow-orange-hover)] text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
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
            <button
              type="button"
              onClick={() => openPlans('browse')}
              className="block text-xs text-stone-400 hover:text-white transition-colors cursor-pointer py-0.5"
            >
              Plans & pricing
            </button>
            <button
              type="button"
              onClick={() => setLegalModal({ isOpen: true, type: 'terms' })}
              className="block text-xs text-stone-400 hover:text-white transition-colors cursor-pointer py-0.5"
            >
              Terms
            </button>
            <button
              type="button"
              onClick={() => setLegalModal({ isOpen: true, type: 'privacy' })}
              className="block text-xs text-stone-400 hover:text-white transition-colors cursor-pointer py-0.5"
            >
              Privacy
            </button>
          </div>

          <CreatedByEden inverted />
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
          plan={planInfo.plan}
          onOpenPlans={() => openPlans('browse')}
        />

        {/* Tab View Container */}
        <div
          key={currentTab}
          className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0"
        >
          {/* DISCOVER TAB */}
          {currentTab === 'discover' && (
            <section aria-label="Discover Section" className="flex-1 flex flex-col justify-center items-center p-4 md:p-8">
              {isLoadingDiscover ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-3 min-h-[60vh]">
                  <div className="w-8 h-8 border-2 border-[var(--color-arrow-orange)] border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-semibold text-[var(--color-stone-dark)]">
                    Finding people...
                  </p>
                </div>
              ) : currentDiscoverProfile ? (
                <div className="w-full max-w-md flex flex-col justify-center my-auto pb-4">
                  <ProfileCard
                    profile={currentDiscoverProfile}
                    onLike={() => handleLike(currentDiscoverProfile)}
                    onSuperLike={() => handleLike(currentDiscoverProfile, true)}
                    onPass={() => handlePass(currentDiscoverProfile)}
                    onRewind={handleRewind}
                    onOpenDetail={() => setDetailProfile(currentDiscoverProfile)}
                    onReport={() => setReportTarget(currentDiscoverProfile)}
                    isAnimating={cardAnimation}
                    canRewind={Boolean(currentUser)}
                    superRemaining={quota?.superRemaining ?? 0}
                  />

                  {quota && !quota.arrowsUnlimited && quota.arrowsRemaining <= 10 && (
                    <button
                      type="button"
                      onClick={() => openPlans('arrows')}
                      className="mt-3 mx-auto block text-center text-[11px] text-[var(--color-stone-dark)] hover:text-[var(--color-arrow-orange-text)]"
                    >
                      {quota.arrowsRemaining > 0
                        ? `${quota.arrowsRemaining} arrows left today · Go unlimited with Plus`
                        : 'Out of arrows for today · Get unlimited with Plus'}
                    </button>
                  )}

                  {currentUser && (
                    <div className="mt-3 flex justify-center">
                      {planInfo.boostActiveUntil && new Date(planInfo.boostActiveUntil) > new Date() ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-gold-subtle)] text-[var(--color-gold)] text-[11px] font-black">
                          <Rocket size={13} />
                          Boosted until {new Date(planInfo.boostActiveUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleBoost}
                          disabled={planInfo.features.boost && planInfo.boostsRemaining <= 0}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[11px] font-bold text-[var(--color-ink)] hover:border-[var(--color-gold-fill)] disabled:opacity-50 transition-colors"
                        >
                          <Rocket size={13} className="text-[var(--color-gold)]" />
                          {planInfo.features.boost
                            ? planInfo.boostsRemaining > 0
                              ? 'Boost me for 30 min'
                              : 'Next boost next week'
                            : 'Boost · Premium'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Authentic Clean State when no more profiles exist in feed */
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 min-h-[60vh]">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-arrow-orange-text)] shadow-xs">
                    <ArrowRight size={28} strokeWidth={2} />
                  </div>
                  <div className="space-y-1.5 max-w-xs">
                    <h3 className="text-2xl font-black tracking-tight text-[var(--color-ink)]">
                      Ready to Discover.
                    </h3>
                    <p className="text-xs text-[var(--color-stone-dark)] leading-relaxed">
                      {currentUser
                        ? "You've seen everyone on ARROW for now. People you passed on come back after a week — or bring them back now. New people join all the time."
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
                          onClick={handleClearPasses}
                          icon={<RotateCcw size={15} />}
                        >
                          See people you passed on
                        </Button>

                        {sentLikes.length > 0 && (
                          <Button
                            variant="outline"
                            fullWidth
                            onClick={() => setCurrentTab('likes')}
                            icon={<Send size={15} />}
                          >
                            {`Waiting on ${sentLikes.length} ${sentLikes.length === 1 ? 'person' : 'people'} you sent arrows to`}
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          fullWidth
                          onClick={() => setIsFilterOpen(true)}
                          icon={<SlidersHorizontal size={15} />}
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
                sentLikes={sentLikes}
                hiddenCount={hiddenLikes}
                onUpgrade={() => openPlans('likes')}
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

          {/* HISTORY TAB */}
          {currentTab === 'history' && (
            <section aria-label="History Section" className="max-w-2xl w-full mx-auto p-4 md:p-6">
              <HistoryList
                entries={history}
                isGuest={!currentUser}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                onViewProfile={(profile) => setDetailProfile(profile)}
                onSendArrow={handleLikeBackFromLikes}
                onOpenChat={(profile) => {
                  const match = matches.find((m) => m.partnerProfile.id === profile.id);
                  if (match) setSelectedMatch(match);
                  else setCurrentTab('matches');
                }}
                onBringBackPasses={handleClearPasses}
                onUnsend={handleUnsend}
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
                planInfo={planInfo}
                onOpenPlans={() => openPlans('browse')}
              />
            </section>
          )}
        </div>

        {/* Mobile Bottom Navigation */}
        <BottomNav
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab)}
          likesCount={incomingLikes.length + hiddenLikes}
          unreadCount={unreadTotal}
        />
      </main>

      {/* Right Activity & Connection Sidebar (Desktop Professional Polish) */}
      <aside className="hidden xl:flex w-80 bg-[var(--color-surface)] border-l border-[var(--color-border)] flex-col shrink-0 overflow-y-auto">
        {/* Activity Section */}
        <div className="p-7 border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink)]/50">
              Activity & Matches
            </h3>
            <span className="text-[11px] font-bold text-[var(--color-arrow-orange-text)]">
              {matches.length + incomingLikes.length} Total
            </span>
          </div>

          {matches.length > 0 || incomingLikes.length > 0 ? (
            <div className="space-y-3">
              {matches.slice(0, 3).map((m) => (
                <div
                  key={m.id}
                  onClick={() => setSelectedMatch(m)}
                  className="flex items-center gap-3 p-2 rounded-2xl hover:bg-[var(--color-surface-subtle)] transition-colors cursor-pointer border border-transparent hover:border-[var(--color-border)]"
                >
                  <Avatar
                    name={m.partnerProfile.name}
                    src={m.partnerProfile.photos[0]}
                    size="sm"
                    rounded="full"
                    className="w-12 h-12 ring-2 ring-[var(--color-arrow-orange)] ring-offset-2"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between">
                      <p className="text-xs font-bold text-[var(--color-ink)] truncate">{m.partnerProfile.name}</p>
                      <span className="text-[10px] font-bold text-[var(--color-forest)] uppercase">Match</span>
                    </div>
                    <p className="text-[11px] text-[var(--color-stone-dark)] truncate">{m.partnerProfile.location}</p>
                  </div>
                </div>
              ))}

              {incomingLikes.slice(0, 2).map((l) => (
                <div
                  key={l.profile.id}
                  onClick={() => {
                    setDetailProfile(l.profile);
                  }}
                  className="flex items-center gap-3 p-2 rounded-2xl hover:bg-[var(--color-surface-subtle)] transition-colors cursor-pointer"
                >
                  <Avatar
                    name={l.profile.name}
                    src={l.profile.photos[0]}
                    size="sm"
                    rounded="full"
                    className="w-12 h-12"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between">
                      <p className="text-xs font-bold text-[var(--color-ink)] truncate">{l.profile.name}</p>
                      <span className="text-[10px] font-bold text-[var(--color-arrow-orange-text)] uppercase">Liked You</span>
                    </div>
                    <p className="text-[11px] text-[var(--color-stone-dark)] truncate">{l.profile.lookingFor || 'Seeking Connection'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 px-2 space-y-1">
              <p className="text-xs font-semibold text-[var(--color-ink)]">
                {currentUser ? 'No recent activity' : 'Guest Mode'}
              </p>
              <p className="text-[11px] text-[var(--color-stone-dark)]">
                {currentUser
                  ? 'Likes and matches will appear here in real-time.'
                  : 'Log in to view incoming likes and active connections.'}
              </p>
            </div>
          )}
        </div>

        {/* Direct Connection (WhatsApp) Section */}
        <div className="flex-1 p-7 bg-[var(--color-offwhite)]/30 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink)]/50">
              Direct Connection
            </h3>

            <div className="p-5 bg-[var(--color-surface)] rounded-3xl border border-[var(--color-border)] shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--color-forest-subtle)] rounded-2xl flex items-center justify-center text-[#25D366] border border-[var(--color-border-subtle)]">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--color-ink)]">Permission-Based</h4>
                  <p className="text-[10px] text-[var(--color-stone-dark)]">WhatsApp Integration</p>
                </div>
              </div>
              <p className="text-[11px] text-[var(--color-stone-dark)] leading-relaxed">
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
                className="w-full py-2.5 px-4 rounded-xl border border-[var(--color-ink)] bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-[var(--color-offwhite)] font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
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

          <div className="p-4 rounded-2xl bg-[var(--color-forest-subtle)] border border-[var(--color-border-subtle)] text-[11px] text-[var(--color-forest)] font-medium space-y-1">
            <p className="font-bold">Human Verified & Protected</p>
            <p className="text-[var(--color-forest)]/80 text-[10px]">
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
        onAuthenticated={handleAuthenticated}
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
        onOpenLegal={(type) => setLegalModal({ isOpen: true, type })}
        onOpenPlans={() => {
          setIsAuthModalOpen(false);
          openPlans('browse');
        }}
      />

      {/* Onboarding Flow Full Overlay */}
      {isOnboarding && (
        <div className="fixed inset-0 z-50 bg-[var(--color-offwhite)] flex flex-col justify-center overflow-y-auto">
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
        arrowSent={Boolean(
          detailProfile &&
            (sentLikes.some((l) => l.profile.id === detailProfile.id) ||
              history.some((h) => h.profile.id === detailProfile.id && h.action !== 'pass' && !h.isMatch))
        )}
        onUnsend={() => {
          if (detailProfile) handleUnsend(detailProfile);
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
        onOpenConversation={() => {
          // Jump straight into the new conversation rather than leaving the
          // person to hunt for it in the matches tab.
          const partnerId = matchCelebration.partnerProfile?.id;
          setCurrentTab('matches');
          setMatchCelebration({ isOpen: false, partnerProfile: null });

          if (partnerId) {
            const found = matches.find((m) => m.partnerProfile.id === partnerId);
            if (found) setSelectedMatch(found);
          }
        }}
      />

      {/* Match Detail View */}
      <MatchDetailModal
        matchItem={selectedMatch}
        isOpen={Boolean(selectedMatch)}
        onClose={() => setSelectedMatch(null)}
        onUnmatch={handleUnmatch}
        onReport={(profile) => setReportTarget(profile)}
        // Only the inbox: refreshing everything here would reshuffle the deck
        // every time a message is read.
        onConversationRead={refreshInbox}
        currentUserId={currentUser?.id ?? null}
        hasReadReceipts={planInfo.features.readReceipts}
        onUpgrade={() => openPlans('receipts')}
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
        canUseAdvanced={planInfo.features.advancedFilters}
        onUpgrade={() => {
          setIsFilterOpen(false);
          openPlans('filters');
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
          onClose={() => {
            setIsEditPhotosOpen(false);
            // Uploads save immediately, so pick them up even after Cancel.
            api.getMyProfile().then((p) => p && setCurrentUser(p));
          }}
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
          onTogglePause={handleTogglePause}
          onToggleOnlineStatus={handleToggleOnlineStatus}
          planInfo={planInfo}
          onOpenPlans={() => openPlans('browse')}
          onManageBilling={handleManageBilling}
          onToggleIncognito={handleToggleIncognito}
        />
      )}

      <NewPasswordModal
        isOpen={isNewPasswordOpen}
        onClose={() => setIsNewPasswordOpen(false)}
      />

      {/* Report & Block User Modal */}
      <ReportModal
        reportedUser={reportTarget}
        isOpen={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        onSubmitReport={handleSubmitReport}
      />

      <PlansModal
        isOpen={plansReason !== null}
        onClose={() => setPlansReason(null)}
        reason={plansReason ?? 'browse'}
        planInfo={planInfo}
        isGuest={!currentUser}
        onStartTrial={handleStartTrial}
        onChoosePlan={handleChoosePlan}
        onManageBilling={handleManageBilling}
        onCancelRenewal={handleCancelRenewal}
        onSignUp={() => {
          setPlansReason(null);
          setIsAuthModalOpen(true);
        }}
        onOpenLegal={(type) => setLegalModal({ isOpen: true, type })}
      />

      <SuperArrowModal
        target={superTarget}
        superRemaining={quota?.superRemaining ?? 0}
        onClose={() => setSuperTarget(null)}
        onSend={async (note) => {
          const target = superTarget;
          setSuperTarget(null);
          if (target) await handleLike(target, true, note);
        }}
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
