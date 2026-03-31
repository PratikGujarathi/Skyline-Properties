import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, getDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Home, MapPin, DollarSign, Trash2, Loader2, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface Property {
  id: string;
  title: string;
  description: string;
  country: string;
  city: string;
  price: number;
  images: string[];
}

interface WishlistItem {
  id: string;
  propertyId: string;
  userId: string;
}

export const Wishlist: React.FC = () => {
  const { user } = useAuth();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const path = 'wishlist';
    const q = query(collection(db, path), where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WishlistItem[];
      
      setWishlistItems(items);
      
      // Fetch property details for each wishlist item
      const propertyPromises = items.map(async (item) => {
        const propDoc = await getDoc(doc(db, 'properties', item.propertyId));
        if (propDoc.exists()) {
          return { id: propDoc.id, ...propDoc.data() } as Property;
        }
        return null;
      });
      
      const resolvedProperties = (await Promise.all(propertyPromises)).filter(p => p !== null) as Property[];
      setProperties(resolvedProperties);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user]);

  const removeFromWishlist = async (propertyId: string) => {
    const item = wishlistItems.find(i => i.propertyId === propertyId);
    if (item) {
      const path = `wishlist/${item.id}`;
      try {
        await deleteDoc(doc(db, 'wishlist', item.id));
        toast.success('Removed from wishlist');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-gold animate-spin mb-4" />
        <p className="text-neutral-500">Loading your wishlist...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-12">
        <h1 className="text-4xl font-extrabold text-neutral-900 dark:text-white mb-2 tracking-tight">
          My Wishlist
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-lg">Your saved properties for future reference.</p>
      </header>

      {properties.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {properties.map((property) => (
            <motion.div
              key={property.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group bg-white dark:bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-200 dark:border-neutral-800 hover:shadow-2xl transition-all"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={property.images?.[0] || `https://picsum.photos/seed/${property.id}/800/600`}
                  alt={property.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
                <button
                  onClick={() => removeFromWishlist(property.id)}
                  className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2 truncate">
                  {property.title}
                </h3>
                <div className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400 text-sm mb-4">
                  <MapPin className="w-4 h-4" />
                  <span>{property.city}, {property.country}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-gold dark:text-gold font-bold text-xl">
                    ${property.price.toLocaleString()}
                  </div>
                  <button className="text-sm font-bold text-gold hover:underline">
                    View Property
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-32 bg-white dark:bg-neutral-900 rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-800">
          <Heart className="w-16 h-16 text-neutral-300 mx-auto mb-6" />
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">Your wishlist is empty</h3>
          <p className="text-neutral-500 text-lg">Browse properties and save your favorites here.</p>
        </div>
      )}
    </div>
  );
};
