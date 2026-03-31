import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppContext } from '../contexts/AppContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { LogOut, User, LayoutDashboard, ShieldCheck, Home, Heart, MessageCircle, Sun, Moon, Globe, Bell } from 'lucide-react';
import { cn } from '../lib/utils';
import { NotificationBell } from './NotificationBell';

export const Navbar: React.FC = () => {
  const { user, profile, isAdmin } = useAuth();
  const { language, setLanguage, theme, toggleTheme, t } = useAppContext();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to={isAdmin ? '/admin' : '/'} className="flex items-center gap-2 group">
            <div className="p-2 bg-navy rounded-lg group-hover:bg-navy/90 transition-colors">
              <Home className="w-5 h-5 text-gold" />
            </div>
            <span className="text-xl font-bold tracking-tight text-navy dark:text-white">
              Skyline<span className="text-gold">Properties</span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-neutral-500 hover:text-gold transition-colors rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            {/* Notifications */}
            {user && <NotificationBell />}

            {/* Language Selector */}
            <div className="relative group">
              <button className="p-2 text-neutral-500 hover:text-gold transition-colors rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 flex items-center gap-1">
                <Globe className="w-5 h-5" />
                <span className="text-xs font-bold uppercase hidden sm:inline">{language}</span>
              </button>
              <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <button onClick={() => setLanguage('en')} className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-t-lg">English</button>
                <button onClick={() => setLanguage('hi')} className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">हिंदी</button>
                <button onClick={() => setLanguage('ar')} className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-b-lg">العربية</button>
              </div>
            </div>

            <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800 mx-1" />

            {user ? (
              <>
                <Link
                  to={isAdmin ? '/admin' : '/dashboard'}
                  className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-gold transition-colors"
                >
                  {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
                  <span className="hidden md:inline">{isAdmin ? t('nav.admin') : t('nav.dashboard')}</span>
                </Link>

                {!isAdmin && (
                  <Link
                    to="/wishlist"
                    className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-gold transition-colors"
                  >
                    <Heart className="w-4 h-4" />
                    <span className="hidden md:inline">{t('nav.wishlist')}</span>
                  </Link>
                )}

                <Link
                  to="/chats"
                  className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-gold transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="hidden md:inline">{t('nav.chats')}</span>
                </Link>
                
                <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800 hidden sm:block" />
                
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end hidden lg:flex">
                    <span className="text-sm font-semibold text-neutral-900 dark:text-white leading-none">
                      {profile?.name || user.displayName}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-500 uppercase">
                      {profile?.role || 'USER'}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-neutral-500 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900"
                    title={t('nav.logout')}
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-gold transition-colors"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-gold text-navy text-sm font-bold rounded-lg hover:bg-gold-hover transition-colors shadow-sm"
                >
                  {t('nav.register')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
