import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Home, ShieldCheck, Search, ArrowRight, Star, Users, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const HomePage: React.FC = () => {
  const { isAdmin, user, isAuthReady, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthReady && !loading && user && isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [isAdmin, user, isAuthReady, loading, navigate]);

  return (
    <div className="bg-white dark:bg-neutral-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 dark:bg-gold/5 text-gold dark:text-gold text-sm font-bold mb-8 border border-gold/20"
            >
              <Star className="w-4 h-4 fill-current" />
              <span>Trusted by 50,000+ Agents worldwide</span>
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-6"
            >
              Skyline <span className="text-gold">Properties</span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-neutral-600 dark:text-neutral-400 mb-10 leading-relaxed"
            >
              Find Your Perfect Property Worldwide.
              The most advanced real estate platform for buyers and agents. 
              Secure, transparent, and built for the modern market.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link
                to="/register"
                className="w-full sm:w-auto px-8 py-4 bg-navy text-gold font-bold rounded-xl hover:bg-navy/90 transition-all shadow-xl shadow-gold/10 dark:shadow-none flex items-center justify-center gap-2 border border-gold/20"
              >
                Get Started Now
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white font-bold rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all"
              >
                Browse Listings
              </Link>
            </motion.div>
          </div>
        </div>
        
        {/* Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 opacity-10 dark:opacity-20 pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-gold/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-navy/20 rounded-full blur-[120px]" />
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-neutral-50 dark:bg-neutral-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-navy rounded-xl flex items-center justify-center text-gold shadow-lg border border-gold/20">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Smart Search</h3>
              <p className="text-neutral-600 dark:text-neutral-400">
                Advanced filters and AI-powered recommendations to find exactly what you're looking for.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-navy rounded-xl flex items-center justify-center text-gold shadow-lg border border-gold/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Verified Agents</h3>
              <p className="text-neutral-600 dark:text-neutral-400">
                Every agent on our platform undergoes a rigorous verification process for your safety.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-navy rounded-xl flex items-center justify-center text-gold shadow-lg border border-gold/20">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Premium Listings</h3>
              <p className="text-neutral-600 dark:text-neutral-400">
                Access to exclusive properties and off-market deals you won't find anywhere else.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-extrabold text-neutral-900 dark:text-white mb-2">12k+</div>
              <div className="text-neutral-500 uppercase tracking-widest text-xs font-bold">Properties</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-neutral-900 dark:text-white mb-2">5k+</div>
              <div className="text-neutral-500 uppercase tracking-widest text-xs font-bold">Agents</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-neutral-900 dark:text-white mb-2">25k+</div>
              <div className="text-neutral-500 uppercase tracking-widest text-xs font-bold">Happy Clients</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-neutral-900 dark:text-white mb-2">150+</div>
              <div className="text-neutral-500 uppercase tracking-widest text-xs font-bold">Cities</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
