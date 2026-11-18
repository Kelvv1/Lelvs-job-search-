import { useState, useRef, useEffect } from 'react';
import { ChevronDown, LogOut, Bookmark, Bell, ShieldCheck, User, Menu, X, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { AppView } from '../types.ts';

interface NavbarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

export function Navbar({ currentView, onNavigate }: NavbarProps) {
  const { dbUser, firebaseUser, signInWithGoogle, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const navItems: Array<{ label: string; view: AppView }> = [
    { label: 'Jobs', view: 'jobs' },
    { label: 'Categories', view: 'categories' },
    { label: 'Remote Jobs', view: 'remote' },
    { label: 'Job Alerts', view: 'alerts' },
  ];

  const handleLinkClick = (view: AppView) => {
    onNavigate(view);
    setMobileOpen(false);
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm transition-colors duration-200">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleLinkClick('home')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0 hover:text-blue-700 dark:hover:text-blue-400 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer"
        >
          Kelvs job search
        </button>

        {/* Zone 2: 4 Clean Single-Line Text Nav Links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Primary Navigation">
          {navItems.map((item) => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => handleLinkClick(item.view)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-blue-700 dark:border-blue-400 text-blue-700 dark:text-blue-400'
                    : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-50 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Theme Switcher + Primary Account Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light background' : 'Switch to dark background'}
            title={theme === 'dark' ? 'Switch to light background' : 'Switch to dark background'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-amber-200 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 shrink-0 cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {firebaseUser ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span className="max-w-[140px] truncate">
                  {dbUser?.displayName || firebaseUser.displayName || 'Account'}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 shadow-lg">
                  <div className="border-b border-slate-100 dark:border-slate-800 px-3.5 py-2">
                    <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                      {dbUser?.email || firebaseUser.email}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                      {dbUser?.role === 'admin' ? 'Administrator Account' : 'Job Seeker Account'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLinkClick('saved')}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Bookmark className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    Saved Jobs
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLinkClick('alerts')}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Bell className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    Job Alerts
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLinkClick('profile')}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <User className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    Profile & Preferences
                  </button>
                  {dbUser?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => handleLinkClick('admin')}
                      className="flex w-full items-center gap-2.5 border-t border-slate-100 dark:border-slate-800 mt-1 pt-2 px-3.5 py-2 text-left text-sm font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Admin Dashboard
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      signOut();
                    }}
                    className="flex w-full items-center gap-2.5 border-t border-slate-100 dark:border-slate-800 mt-1 pt-2 px-3.5 py-2 text-left text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 text-slate-400" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={signInWithGoogle}
              className="h-10 rounded-lg bg-blue-700 dark:bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Sign In
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.view}
                type="button"
                onClick={() => handleLinkClick(item.view)}
                className={`rounded-md px-3 py-2.5 text-left text-sm font-medium ${
                  currentView === item.view
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
