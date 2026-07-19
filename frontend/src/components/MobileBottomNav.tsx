import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface TabItem {
  path: string;
  label: string;
  icon: string;
  activeIcon: string;
}

const studentTabs: TabItem[] = [
  { path: '/kid-home', label: '乐园', icon: '🎮', activeIcon: '🎮' },
  { path: '/learn', label: '学习', icon: '📖', activeIcon: '📖' },
  { path: '/review', label: '复习', icon: '🔄', activeIcon: '🔄' },
  { path: '/garden', label: '花园', icon: '🌱', activeIcon: '🌻' },
  { path: '/profile', label: '我的', icon: '👤', activeIcon: '👤' },
];

const parentTabs: TabItem[] = [
  { path: '/parent', label: '孩子', icon: '👶', activeIcon: '👶' },
  { path: '/parent/report', label: '日报', icon: '📋', activeIcon: '📋' },
  { path: '/profile', label: '我的', icon: '👤', activeIcon: '👤' },
];

const MobileBottomNav: React.FC = () => {
  const { isAuthenticated, isStudent, isParent } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return null;

  // Only show bottom nav for students and parents
  if (!isStudent && !isParent) return null;

  const tabs = isStudent ? studentTabs : parentTabs;

  const isActive = (path: string) => {
    // Exact match for root paths, prefix match for sub-routes
    if (path === '/parent' || path === '/kid-home') {
      return location.pathname === path;
    }
    if (path === '/profile') {
      return location.pathname === '/profile';
    }
    // For other tabs, check if path starts with the tab path
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-around h-14 pb-safe">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors relative ${
                active ? 'text-primary-500' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {active && (
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-500 rounded-full" />
              )}
              <span className="text-xl leading-none">{active ? tab.activeIcon : tab.icon}</span>
              <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
