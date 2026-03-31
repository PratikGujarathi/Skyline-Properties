import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Trash2, Clock } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Alert {
  id: string;
  userId: string;
  type: 'new_listing' | 'price_drop' | 'appointment_update';
  message: string;
  read: boolean;
  createdAt: any;
  relatedId?: string;
  propertyId?: string;
  propertyData?: {
    title: string;
    price: number;
    city: string;
    image: string | null;
  };
}

export const NotificationBell: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'alerts'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newAlerts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Alert[];
      setAlerts(newAlerts);
      setUnreadCount(newAlerts.filter(a => !a.read).length);
    });

    return () => unsubscribe();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'alerts', id), { read: true });
    } catch (error) {
      console.error("Error marking alert as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadAlerts = alerts.filter(a => !a.read);
      await Promise.all(unreadAlerts.map(a => updateDoc(doc(db, 'alerts', a.id), { read: true })));
    } catch (error) {
      console.error("Error marking all alerts as read:", error);
    }
  };

  const deleteAlert = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'alerts', id));
    } catch (error) {
      console.error("Error deleting alert:", error);
    }
  };

  const formatTime = (date: any) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return formatDistanceToNow(d, { addSuffix: true });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-neutral-500 hover:text-gold transition-colors rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-neutral-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/50">
                <h3 className="font-bold text-neutral-900 dark:text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
                {alerts.length > 0 ? (
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {alerts.map((alert) => (
                      <div 
                        key={alert.id}
                        className={cn(
                          "p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors relative group",
                          !alert.read && "bg-indigo-50/30 dark:bg-indigo-900/10"
                        )}
                      >
                        <div className="flex gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full mt-1.5 shrink-0",
                            alert.read ? "bg-transparent" : "bg-indigo-600"
                          )} />
                          {alert.propertyData?.image && (
                            <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800">
                              <img 
                                src={alert.propertyData.image} 
                                alt={alert.propertyData.title}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          <div className="flex-1 space-y-1">
                            <p className="text-sm text-neutral-900 dark:text-white leading-relaxed">
                              {alert.message}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                              <Clock className="w-3 h-3" />
                              <span>{formatTime(alert.createdAt)}</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!alert.read && (
                              <button 
                                onClick={() => markAsRead(alert.id)}
                                className="p-1 text-neutral-400 hover:text-green-500 transition-colors"
                                title="Mark as read"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            <button 
                              onClick={() => deleteAlert(alert.id)}
                              className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Bell className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
                    <p className="text-neutral-500 text-sm">No notifications yet</p>
                  </div>
                )}
              </div>

              {alerts.length > 0 && (
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800 text-center">
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="text-xs font-bold text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
