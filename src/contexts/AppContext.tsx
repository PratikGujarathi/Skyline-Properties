import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'hi' | 'ar';
type Theme = 'light' | 'dark';

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  toggleTheme: () => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    'nav.home': 'Home',
    'nav.dashboard': 'Dashboard',
    'nav.wishlist': 'Wishlist',
    'nav.chats': 'Chats',
    'nav.admin': 'Admin',
    'nav.login': 'Login',
    'nav.register': 'Register',
    'nav.logout': 'Logout',
    'home.hero.title': 'Find Your Luxury Home',
    'home.hero.subtitle': 'Exclusive properties in the most prestigious locations.',
    'dashboard.welcome': 'Welcome back',
    'dashboard.browse': 'Browse Properties',
    'dashboard.documents': 'My Documents',
    'dashboard.saved_searches': 'Saved Searches',
    'dashboard.alerts': 'Property Alerts',
    'property.type.villa': 'Villa',
    'property.type.flat': 'Flat',
    'property.type.plot': 'Plot',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.loading': 'Loading...',
  },
  hi: {
    'nav.home': 'होम',
    'nav.dashboard': 'डैशबोर्ड',
    'nav.wishlist': 'विशलिस्ट',
    'nav.chats': 'चैट',
    'nav.admin': 'एडमिन',
    'nav.login': 'लॉगिन',
    'nav.register': 'रजिस्टर',
    'nav.logout': 'लॉगआउट',
    'home.hero.title': 'अपना लक्जरी घर खोजें',
    'home.hero.subtitle': 'सबसे प्रतिष्ठित स्थानों में विशेष संपत्तियां।',
    'dashboard.welcome': 'वापस स्वागत है',
    'dashboard.browse': 'संपत्तियां देखें',
    'dashboard.documents': 'मेरे दस्तावेज़',
    'dashboard.saved_searches': 'सहेजे गए खोज',
    'dashboard.alerts': 'संपत्ति अलर्ट',
    'property.type.villa': 'विला',
    'property.type.flat': 'फ्लैट',
    'property.type.plot': 'प्लॉट',
    'common.search': 'खोजें',
    'common.filter': 'फ़िल्टर',
    'common.save': 'सहेजें',
    'common.delete': 'हटाएं',
    'common.loading': 'लोड हो रहा है...',
  },
  ar: {
    'nav.home': 'الرئيسية',
    'nav.dashboard': 'لوحة التحكم',
    'nav.wishlist': 'قائمة الرغبات',
    'nav.chats': 'المحادثات',
    'nav.admin': 'المسؤول',
    'nav.login': 'تسجيل الدخول',
    'nav.register': 'تسجيل',
    'nav.logout': 'تسجيل الخروج',
    'home.hero.title': 'ابحث عن منزلك الفاخر',
    'home.hero.subtitle': 'عقارات حصرية في أرقى المواقع.',
    'dashboard.welcome': 'مرحباً بعودتك',
    'dashboard.browse': 'تصفح العقارات',
    'dashboard.documents': 'مستنداتي',
    'dashboard.saved_searches': 'عمليات البحث المحفوظة',
    'dashboard.alerts': 'تنبيهات العقارات',
    'property.type.villa': 'فيلا',
    'property.type.flat': 'شقة',
    'property.type.plot': 'أرض',
    'common.search': 'بحث',
    'common.filter': 'تصفية',
    'common.save': 'حفظ',
    'common.delete': 'حذف',
    'common.loading': 'جاري التحميل...',
  }
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('app_lang') as Language) || 'en';
  });
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('app_theme') as Theme;
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('app_lang', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    localStorage.setItem('app_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <AppContext.Provider value={{ language, setLanguage, theme, toggleTheme, t }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
