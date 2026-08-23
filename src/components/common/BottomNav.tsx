import React from 'react';
import { Compass, Heart, Users, User } from 'lucide-react';
import { TabType } from '../../types';

interface BottomNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  likesCount: number;
  matchesCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  likesCount,
  matchesCount,
}) => {
  const tabs: Array<{
    id: TabType;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    {
      id: 'discover',
      label: 'Discover',
      icon: <Compass size={20} strokeWidth={2.2} />,
    },
    {
      id: 'likes',
      label: 'Likes',
      icon: <Heart size={20} strokeWidth={2.2} />,
      badge: likesCount,
    },
    {
      id: 'matches',
      label: 'Matches',
      icon: <Users size={20} strokeWidth={2.2} />,
      badge: matchesCount,
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: <User size={20} strokeWidth={2.2} />,
    },
  ];

  return (
    <nav
      className="lg:hidden sticky bottom-0 z-30 w-full bg-[#F5F3EE]/95 backdrop-blur-md border-t border-[#D9D6CF] px-3 py-2 flex items-center justify-around select-none"
      aria-label="Main Navigation"
    >
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`relative flex flex-col items-center justify-center min-w-[72px] min-h-[48px] py-1 px-2 rounded-2xl transition-all duration-150 cursor-pointer ${
              isActive
                ? 'text-[#111111] font-bold'
                : 'text-[#7A766E] hover:text-[#111111] font-medium'
            }`}
            aria-selected={isActive}
            role="tab"
          >
            <div className="relative flex items-center justify-center">
              {tab.icon}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-[#E85D2A] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center leading-tight shadow-xs">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-1 tracking-tight uppercase font-bold flex items-center gap-1">
              {tab.label}
              {isActive && <span className="w-1 h-1 rounded-full bg-[#E85D2A]" />}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

