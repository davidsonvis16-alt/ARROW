import React from 'react';
import { SlidersHorizontal, Shield, User, LogIn } from 'lucide-react';
import { TabType, UserProfile } from '../../types';

interface HeaderProps {
  currentTab: TabType;
  currentUser?: UserProfile | null;
  onOpenFilter?: () => void;
  hasActiveFilters?: boolean;
  onOpenSafety?: () => void;
  onOpenAuth?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  currentUser,
  onOpenFilter,
  hasActiveFilters = false,
  onOpenSafety,
  onOpenAuth,
}) => {
  const tabTitles: Record<TabType, string> = {
    discover: 'Discover',
    likes: 'Likes & Arrows',
    matches: 'Mutual Matches',
    profile: 'Profile & Settings',
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-5 md:px-8 py-3.5 bg-[#F5F3EE]/90 backdrop-blur-md border-b border-[#D9D6CF]">
      {/* Brand Wordmark with Diamond Arrow Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-[#E85D2A] flex items-center justify-center transform rotate-45 rounded-[3px] shadow-xs">
            <div className="w-2 h-2 border-t-2 border-r-2 border-white transform -rotate-45 ml-[-1px] mt-[1px]" />
          </div>
          <span className="text-xl font-bold tracking-tighter uppercase font-mono text-[#111111]">
            ARROW
          </span>
        </div>

        {currentTab !== 'discover' && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-[#7A766E] uppercase tracking-wider pl-3 border-l border-[#D9D6CF]">
            {tabTitles[currentTab]}
          </div>
        )}
      </div>

      {/* Right Action Icons & Profile Login */}
      <div className="flex items-center gap-2 md:gap-3">
        {currentTab === 'discover' && onOpenFilter && (
          <button
            type="button"
            onClick={onOpenFilter}
            className={`relative p-2.5 rounded-full border transition-all duration-150 flex items-center justify-center cursor-pointer ${
              hasActiveFilters
                ? 'bg-[#111111] text-[#F5F3EE] border-[#111111] shadow-xs'
                : 'bg-white text-[#111111] border-[#D9D6CF] hover:bg-stone-50'
            }`}
            aria-label="Discovery filters"
            title="Discovery Filters"
          >
            <SlidersHorizontal size={16} />
            {hasActiveFilters && (
              <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-[#E85D2A] ring-2 ring-[#F5F3EE]" />
            )}
          </button>
        )}

        {onOpenSafety && (
          <button
            type="button"
            onClick={onOpenSafety}
            className="p-2.5 rounded-full bg-white text-[#111111] border border-[#D9D6CF] hover:bg-stone-50 transition-colors cursor-pointer"
            title="Safety & Community Guidelines"
            aria-label="Safety center"
          >
            <Shield size={16} />
          </button>
        )}

        {/* Top Profile / Login Button */}
        {onOpenAuth && (
          currentUser ? (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-2 pl-1.5 pr-3 py-1 bg-white hover:bg-stone-50 border border-[#D9D6CF] rounded-full transition-all duration-150 cursor-pointer shadow-2xs group"
              title={`Logged in as ${currentUser.name} - Click for Account Options`}
              aria-label="User Account"
            >
              <div className="w-7 h-7 rounded-full overflow-hidden bg-stone-200 border border-[#D9D6CF] shrink-0">
                <img
                  src={
                    currentUser.photos[0] ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'
                  }
                  alt={currentUser.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="text-xs font-bold text-[#111111] max-w-[90px] truncate hidden sm:inline">
                {currentUser.name}
              </span>
              <span className="w-2 h-2 rounded-full bg-[#17352F] shrink-0" title="Active Account" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111111] hover:bg-black text-[#F5F3EE] border border-[#111111] transition-all duration-150 cursor-pointer shadow-xs font-sans text-xs font-bold"
              title="Log In or Create Profile"
              aria-label="Log In"
            >
              <User size={15} className="text-[#E85D2A]" />
              <span>Log In</span>
            </button>
          )
        )}
      </div>
    </header>
  );
};


