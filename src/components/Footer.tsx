import React from 'react';
import { Home, Mail, Phone, MapPin, Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-navy rounded-lg border border-gold/20">
                <Home className="w-5 h-5 text-gold" />
              </div>
              <span className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                Skyline<span className="text-gold">Properties</span>
              </span>
            </div>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
              The world's most trusted real estate platform. We help you find the perfect place to call home with ease and security.
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-6">Quick Links</h4>
            <ul className="space-y-4">
              <li><a href="/" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-gold transition-colors">Home</a></li>
              <li><a href="/dashboard" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-gold transition-colors">Properties</a></li>
              <li><a href="/login" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-gold transition-colors">Sign In</a></li>
              <li><a href="/register" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-gold transition-colors">Register</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-6">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
                <Mail className="w-4 h-4 text-gold" />
                <span>support@skylineproperties.com</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
                <Phone className="w-4 h-4 text-gold" />
                <span>+1 (555) 000-0000</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
                <MapPin className="w-4 h-4 text-gold" />
                <span>123 Luxury Lane, Beverly Hills, CA</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-6">Follow Us</h4>
            <div className="flex gap-4">
              <a href="#" className="p-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-500 hover:text-gold transition-all">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-500 hover:text-gold transition-all">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-500 hover:text-gold transition-all">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-500 hover:text-gold transition-all">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
        
        <div className="pt-8 border-t border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            © 2026 SkylineProperties Inc. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
