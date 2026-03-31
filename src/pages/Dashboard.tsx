import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy, limit, startAfter, getDocs, where, QueryConstraint, addDoc, deleteDoc, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useAppContext } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { Home, MapPin, DollarSign, Calendar, Search, Filter, Bed, Bath, Maximize, Maximize2, ChevronRight, Loader2, Globe, Building2, Tag, Heart, Star, MessageSquare, Clock, X, CheckCircle2, MessageCircle, Sparkles, AlertTriangle, TrendingUp as TrendingUpIcon, FileText, Download, LayoutDashboard, Bell, Save, Trash2, PieChart as PieChartIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from 'recharts';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { cn } from '../lib/utils';
import { VirtualTourViewer } from '../components/VirtualTourViewer';
import { MortgageCalculator } from '../components/MortgageCalculator';
import { AIAssistant } from '../components/AIAssistant';
import { toast } from 'sonner';
import { GoogleGenAI, Type } from "@google/genai";

interface Property {
  id: string;
  title: string;
  description: string;
  country: string;
  city: string;
  area: string;
  price: number;
  type: 'villa' | 'flat' | 'plot';
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  images: string[];
  virtualTourURL: string;
  status: 'available' | 'sold';
  agentId: string;
  createdAt: any;
}

interface AnalysisResult {
  recommendation: 'Buy' | 'Wait' | 'Avoid';
  growthPrediction: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  reasoning: string;
}

interface NeighborhoodInsights {
  schools: string[];
  transit: string[];
  restaurants: string[];
  vibe: string;
  safetyScore: string;
}

interface Review {
  id: string;
  propertyId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface DocumentRecord {
  id: string;
  propertyId: string;
  userId: string;
  agreementURL?: string;
  paperworkURL?: string;
  createdAt: string;
  propertyTitle?: string;
  userEmail?: string;
}

interface SavedSearch {
  id: string;
  userId: string;
  filters: any;
  name: string;
  createdAt: string;
}

interface Alert {
  id: string;
  userId: string;
  type: 'new_listing' | 'price_drop' | 'appointment_update';
  message: string;
  read: boolean;
  createdAt: string;
  relatedId?: string;
  propertyId?: string;
  propertyData?: {
    title: string;
    price: number;
    city: string;
    image: string | null;
  };
}

const PAGE_SIZE = 6;

export const Dashboard: React.FC = () => {
  const { user, profile, loading: authLoading, isAuthReady } = useAuth();
  const { t, theme } = useAppContext();
  const isDark = theme === 'dark';
  
  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    if (date.toDate) return date.toDate().toLocaleDateString();
    return new Date(date).toLocaleDateString();
  };
  const [properties, setProperties] = useState<Property[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'browse' | 'documents' | 'searches' | 'alerts'>('browse');
  const [loadingMore, setLoadingMore] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE * 2);
  const [hasMore, setHasMore] = useState(true);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [isSavingSearch, setIsSavingSearch] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [showSaveSearchModal, setShowSaveSearchModal] = useState(false);

  // Modal states
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);

  // Appointment form state
  const [appointmentDate, setAppointmentDate] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<Record<string, AnalysisResult>>({});
  const [isAnalyzingNeighborhood, setIsAnalyzingNeighborhood] = useState(false);
  const [neighborhoodInsightsMap, setNeighborhoodInsightsMap] = useState<Record<string, NeighborhoodInsights>>({});
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  
  // AI Staging state
  const [isReimagining, setIsReimagining] = useState(false);
  const [reimaginedImages, setReimaginedImages] = useState<Record<string, string>>({});
  const [selectedStagingStyle, setSelectedStagingStyle] = useState<'Modern Minimalist' | 'Industrial' | 'Boho' | 'Luxury'>('Modern Minimalist');
  
  const navigate = useNavigate();

  // Review form state
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [propertyReviews, setPropertyReviews] = useState<Review[]>([]);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    country: '',
    city: '',
    minPrice: '',
    maxPrice: '',
    type: '' as 'villa' | 'flat' | 'plot' | '',
  });

  useEffect(() => {
    const path = 'properties';
    setLoading(true);
    
    console.log('Setting up properties listener...', { filters, displayLimit });
    const constraints: QueryConstraint[] = [];
    
    // To avoid complex index requirements, we'll only filter by status
    // and perform the rest of the filtering and sorting on the client side.
    // This ensures the query always works even without composite indexes.
    const q = query(
      collection(db, path),
      where('status', '==', 'available'),
      limit(displayLimit * 5) // Fetch more to allow for client-side filtering and sorting
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`Received properties snapshot: ${snapshot.docs.length} documents`);
      const newProps = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Property[];
      
      // Client-side sorting by createdAt desc
      let sortedProps = [...newProps].sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });

      // Client-side filtering for all filters
      let filteredProps = sortedProps;
      
      if (filters.country) {
        filteredProps = filteredProps.filter(p => p.country.toLowerCase() === filters.country.toLowerCase());
      }
      if (filters.city) {
        filteredProps = filteredProps.filter(p => p.city.toLowerCase() === filters.city.toLowerCase());
      }
      if (filters.type) {
        filteredProps = filteredProps.filter(p => p.type === filters.type);
      }
      if (filters.minPrice) {
        filteredProps = filteredProps.filter(p => p.price >= parseFloat(filters.minPrice));
      }
      if (filters.maxPrice) {
        filteredProps = filteredProps.filter(p => p.price <= parseFloat(filters.maxPrice));
      }

      console.log(`Filtered properties: ${filteredProps.length} / ${newProps.length}`);
      setProperties(filteredProps.slice(0, displayLimit));
      setLoading(false);
      setHasMore(newProps.length >= displayLimit * 2);
    }, (error) => {
      console.error('Error fetching properties in Dashboard:', error);
      toast.error('Failed to load properties. Please check your connection.');
      handleFirestoreError(error, OperationType.LIST, path);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filters, displayLimit]);

  useEffect(() => {
    if (!user) return;
    const path = 'wishlist';
    const q = query(collection(db, path), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.data().propertyId);
      setWishlistIds(ids);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!isAuthReady || authLoading) return;
    if (!user || activeTab !== 'documents') return;

    const path = 'documents';
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const docs = await Promise.all(snapshot.docs.map(async (d) => {
        const data = d.data();
        // Fetch property title
        const propDoc = await getDoc(doc(db, 'properties', data.propertyId));
        return {
          id: d.id,
          ...data,
          propertyTitle: propDoc.exists() ? propDoc.data().title : 'Unknown Property'
        };
      })) as DocumentRecord[];
      setDocuments(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user, activeTab, isAuthReady, authLoading]);

  useEffect(() => {
    if (!isAuthReady || authLoading) return;
    if (!user || activeTab !== 'searches') return;
    const path = 'saved_searches';
    const q = query(collection(db, path), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSavedSearches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SavedSearch[]);
    });
    return () => unsubscribe();
  }, [user, activeTab, isAuthReady, authLoading]);

  useEffect(() => {
    if (!isAuthReady || authLoading) return;
    if (!user || activeTab !== 'alerts') return;
    const path = 'alerts';
    const q = query(collection(db, path), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Alert[]);
    });
    return () => unsubscribe();
  }, [user, activeTab, isAuthReady, authLoading]);

  const toggleWishlist = async (propertyId: string) => {
    if (!user) return;
    const isWishlisted = wishlistIds.includes(propertyId);
    const path = 'wishlist';

    try {
      if (isWishlisted) {
        const q = query(collection(db, path), where('userId', '==', user.uid), where('propertyId', '==', propertyId));
        const snapshot = await getDocs(q);
        snapshot.forEach(async (d) => {
          await deleteDoc(doc(db, path, d.id));
        });
        toast.success('Removed from wishlist');
      } else {
        await addDoc(collection(db, path), {
          userId: user.uid,
          propertyId,
          createdAt: serverTimestamp()
        });
        toast.success('Added to wishlist');
      }
    } catch (error) {
      handleFirestoreError(error, isWishlisted ? OperationType.DELETE : OperationType.CREATE, path);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProperty) return;
    
    setIsBooking(true);
    const path = 'appointments';
    try {
      await addDoc(collection(db, path), {
        propertyId: selectedProperty.id,
        userId: user.uid,
        agentId: selectedProperty.agentId,
        date: appointmentDate,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Create alert for agent
      await addDoc(collection(db, 'alerts'), {
        userId: selectedProperty.agentId,
        type: 'appointment_update',
        message: `New viewing request for "${selectedProperty.title}" from ${profile?.name || user.email}`,
        read: false,
        createdAt: serverTimestamp(),
        relatedId: selectedProperty.id
      });

      toast.success('Appointment requested successfully!');
      setShowAppointmentModal(false);
      setAppointmentDate('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsBooking(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProperty) return;

    setIsSubmittingReview(true);
    const path = 'reviews';
    try {
      await addDoc(collection(db, path), {
        propertyId: selectedProperty.id,
        userId: user.uid,
        userName: profile?.name || 'Anonymous',
        rating,
        comment,
        createdAt: serverTimestamp()
      });
      toast.success('Review submitted!');
      setComment('');
      setRating(5);
      fetchReviews(selectedProperty.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const fetchReviews = async (propertyId: string) => {
    const path = 'reviews';
    const q = query(collection(db, path), where('propertyId', '==', propertyId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Review[];
    setPropertyReviews(reviews);
  };

  const openDetails = (property: Property) => {
    setSelectedProperty(property);
    fetchReviews(property.id);
    setShowDetailsModal(true);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const startChat = async () => {
    if (!user || !selectedProperty || !profile) return;
    setIsStartingChat(true);
    const path = 'chats';
    try {
      // Check if chat already exists
      const q = query(
        collection(db, path),
        where('participants', 'array-contains', user.uid)
      );
      const snapshot = await getDocs(q);
      let existingChat = snapshot.docs.find(doc => doc.data().participants.includes(selectedProperty.agentId));

      if (existingChat) {
        navigate('/chats', { state: { chatId: existingChat.id } });
        return;
      }

      // Fetch agent name
      const agentDoc = await getDoc(doc(db, 'users', selectedProperty.agentId));
      const agentData = agentDoc.data();
      const agentName = agentData?.name || 'Agent';

      const newChatRef = doc(collection(db, path));
      await setDoc(newChatRef, {
        participants: [user.uid, selectedProperty.agentId],
        participantNames: {
          [user.uid]: profile.name,
          [selectedProperty.agentId]: agentName
        },
        updatedAt: new Date().toISOString(),
        lastMessage: 'Chat started'
      });

      navigate('/chats', { state: { chatId: newChatRef.id } });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsStartingChat(false);
    }
  };

  const handleBuyProperty = async () => {
    if (!user || !selectedProperty || !profile) return;
    
    setIsBuying(true);
    const toastId = toast.loading('Processing purchase request...', { id: 'buy-toast' });
    
    try {
      // 1. Update property status
      await updateDoc(doc(db, 'properties', selectedProperty.id), {
        status: 'sold',
        updatedAt: serverTimestamp()
      });

      // 2. Create transaction
      const commissionRate = 0.05; // 5% commission
      await addDoc(collection(db, 'transactions'), {
        propertyId: selectedProperty.id,
        agentId: selectedProperty.agentId,
        userId: user.uid,
        userEmail: user.email,
        price: selectedProperty.price,
        commission: selectedProperty.price * commissionRate,
        status: 'completed',
        createdAt: serverTimestamp()
      });

      // 3. Create alert for agent
      await addDoc(collection(db, 'alerts'), {
        userId: selectedProperty.agentId,
        type: 'appointment_update',
        message: `Property "${selectedProperty.title}" has been purchased by ${profile.name}!`,
        read: false,
        createdAt: new Date().toISOString(),
        relatedId: selectedProperty.id
      });

      toast.success('Congratulations! Your purchase request has been processed.', { id: 'buy-toast' });
      setShowDetailsModal(false);
    } catch (error: any) {
      console.error('Error buying property:', error);
      toast.error('Failed to process purchase: ' + (error.message || 'Unknown error'), { id: 'buy-toast' });
    } finally {
      setIsBuying(false);
    }
  };

  const analyzeProperty = async () => {
    if (!selectedProperty) return;
    setIsAnalyzing(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this property:
          Title: ${selectedProperty.title}
          Location: ${selectedProperty.area}, ${selectedProperty.city}, ${selectedProperty.country}
          Price: $${selectedProperty.price}
          Type: ${selectedProperty.type}
          Features: ${selectedProperty.bedrooms} beds, ${selectedProperty.bathrooms} baths, ${selectedProperty.sqft} sqft
          Description: ${selectedProperty.description}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendation: { type: Type.STRING, enum: ['Buy', 'Wait', 'Avoid'] },
              growthPrediction: { type: Type.STRING },
              riskLevel: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
              reasoning: { type: Type.STRING }
            },
            required: ['recommendation', 'growthPrediction', 'riskLevel', 'reasoning']
          }
        }
      });

      if (response.text) {
        setAnalysisResults(prev => ({ ...prev, [selectedProperty.id]: JSON.parse(response.text) }));
      }
    } catch (error) {
      console.error("AI Analysis failed:", error);
      toast.error("Failed to analyze property. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeNeighborhood = async () => {
    if (!selectedProperty) return;
    setIsAnalyzingNeighborhood(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide a "Local's Guide" for this neighborhood:
          Area: ${selectedProperty.area}
          City: ${selectedProperty.city}
          Country: ${selectedProperty.country}
          Property Title: ${selectedProperty.title}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              schools: { type: Type.ARRAY, items: { type: Type.STRING } },
              transit: { type: Type.ARRAY, items: { type: Type.STRING } },
              restaurants: { type: Type.ARRAY, items: { type: Type.STRING } },
              vibe: { type: Type.STRING },
              safetyScore: { type: Type.STRING }
            },
            required: ['schools', 'transit', 'restaurants', 'vibe', 'safetyScore']
          }
        }
      });

      if (response.text) {
        setNeighborhoodInsightsMap(prev => ({ ...prev, [selectedProperty.id]: JSON.parse(response.text) }));
      }
    } catch (error) {
      console.error("Neighborhood Analysis failed:", error);
      toast.error("Failed to analyze neighborhood. Please try again.");
    } finally {
      setIsAnalyzingNeighborhood(false);
    }
  };

  const reimagineRoom = async () => {
    if (!selectedProperty) return;
    setIsReimagining(true);
    const toastId = toast.loading(`Reimagining in ${selectedStagingStyle} style...`);

    try {
      const currentImage = selectedProperty.images?.[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1000&auto=format&fit=crop';
      
      // Fetch image and convert to base64
      const imgResponse = await fetch(currentImage);
      const blob = await imgResponse.blob();
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
            { text: `Interior design task: Reimagine this room in a ${selectedStagingStyle} style. Keep the walls, windows, and floor plan exactly the same. Replace all existing furniture with new ${selectedStagingStyle} furniture. Add high-quality lighting and decor. Output ONLY the reimagined image.` }
          ]
        }
      });

      let imageUrl = '';
      let textResponse = '';
      
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          } else if (part.text) {
            textResponse += part.text;
          }
        }
      }

      if (imageUrl) {
        setReimaginedImages(prev => ({ ...prev, [selectedProperty.id]: imageUrl }));
        toast.success("Room reimagined successfully!", { id: toastId });
      } else {
        const reason = response.candidates?.[0]?.finishReason || 'Unknown';
        console.error("AI Staging failed. Reason:", reason, "Text:", textResponse);
        throw new Error(textResponse || `Model did not return an image. (Reason: ${reason})`);
      }
    } catch (error: any) {
      console.error("AI Staging failed:", error);
      toast.error(`AI Staging failed: ${error.message || 'Unknown error'}`, { id: toastId });
    } finally {
      setIsReimagining(false);
    }
  };

  const generateMarketData = (basePrice: number) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data = [];
    let currentPrice = basePrice * 0.85;
    let currentAvg = basePrice * 0.88;

    for (let i = 0; i < 12; i++) {
      currentPrice *= (1 + (Math.random() * 0.04 - 0.01));
      currentAvg *= (1 + (Math.random() * 0.03 - 0.005));
      data.push({
        month: months[i],
        property: Math.round(currentPrice),
        neighborhood: Math.round(currentAvg)
      });
    }
    return data;
  };

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      if (prev.length >= 3) {
        toast.error("You can only compare up to 3 properties at a time.");
        return prev;
      }
      return [...prev, id];
    });
  };

  const clearFilters = () => {
    setFilters({
      country: '',
      city: '',
      minPrice: '',
      maxPrice: '',
      type: '',
    });
  };

  const handleSaveSearch = async () => {
    if (!user || !searchName) return;
    setIsSavingSearch(true);
    const path = 'saved_searches';
    try {
      await addDoc(collection(db, path), {
        userId: user.uid,
        name: searchName,
        filters,
        createdAt: new Date().toISOString()
      });
      toast.success('Search saved successfully!');
      setShowSaveSearchModal(false);
      setSearchName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSavingSearch(false);
    }
  };

  const deleteSavedSearch = async (id: string) => {
    const path = 'saved_searches';
    try {
      await deleteDoc(doc(db, path, id));
      toast.success('Search deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const applySavedSearch = (savedFilters: any) => {
    setFilters(savedFilters);
    setActiveTab('browse');
    toast.info('Filters applied');
  };

  const markAlertAsRead = async (id: string) => {
    const path = 'alerts';
    try {
      await setDoc(doc(db, path, id), { read: true }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteAlert = async (id: string) => {
    const path = 'alerts';
    try {
      await deleteDoc(doc(db, path, id));
      toast.success('Alert deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl font-extrabold text-neutral-900 dark:text-white mb-2 tracking-tight"
          >
            Welcome, {profile?.name}!
          </motion.h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-lg">Discover your next investment or home across the globe.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('browse')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                activeTab === 'browse' 
                  ? "bg-white dark:bg-neutral-900 text-gold shadow-sm" 
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              {t('dashboard.browse')}
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                activeTab === 'documents' 
                  ? "bg-white dark:bg-neutral-900 text-gold shadow-sm" 
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              <FileText className="w-4 h-4" />
              {t('dashboard.documents')}
            </button>
            <button
              onClick={() => setActiveTab('searches')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                activeTab === 'searches' 
                  ? "bg-white dark:bg-neutral-900 text-gold shadow-sm" 
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              <Search className="w-4 h-4" />
              {t('dashboard.saved_searches')}
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                activeTab === 'alerts' 
                  ? "bg-white dark:bg-neutral-900 text-gold shadow-sm" 
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              <Bell className="w-4 h-4" />
              {t('dashboard.alerts')}
            </button>
          </div>
          {activeTab === 'browse' && (
            <div className="flex gap-2">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-sm border",
                  showFilters 
                    ? "bg-navy text-white border-navy" 
                    : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                )}
              >
                <Filter className="w-5 h-5" />
                <span>{showFilters ? 'Hide Filters' : t('common.filter')}</span>
              </button>
              {showFilters && (
                <button 
                  onClick={() => setShowSaveSearchModal(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-sm border bg-gold text-navy border-gold hover:bg-gold-hover"
                >
                  <Save className="w-5 h-5" />
                  <span>{t('common.save')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {activeTab === 'browse' ? (
        <>
          <AnimatePresence>
            {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-12"
          >
            <div className="bg-white dark:bg-neutral-900 p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Country</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    name="country"
                    placeholder="e.g. USA"
                    value={filters.country}
                    onChange={handleFilterChange}
                    className="w-full pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">City</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    name="city"
                    placeholder="e.g. London"
                    value={filters.city}
                    onChange={handleFilterChange}
                    className="w-full pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Type</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <select
                    name="type"
                    value={filters.type}
                    onChange={handleFilterChange}
                    className="w-full pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white appearance-none"
                  >
                    <option value="">All Types</option>
                    <option value="flat">Flat</option>
                    <option value="villa">Villa</option>
                    <option value="plot">Plot</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Min Price</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="number"
                    name="minPrice"
                    placeholder="Min"
                    value={filters.minPrice}
                    onChange={handleFilterChange}
                    className="w-full pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <button
                  onClick={clearFilters}
                  className="w-full py-2 text-sm font-bold text-neutral-500 hover:text-indigo-600 transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-[450px] bg-neutral-100 dark:bg-neutral-900 rounded-3xl skeleton" />
          ))}
        </div>
      ) : activeTab === 'browse' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {properties.map((property, index) => (
              <motion.div
                key={property.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (index % PAGE_SIZE) * 0.1 }}
                className="group bg-white dark:bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-200 dark:border-neutral-800 hover:shadow-2xl transition-all hover:-translate-y-2"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={property.images?.[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1000&auto=format&fit=crop'}
                    alt={property.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1000&auto=format&fit=crop';
                    }}
                  />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className="px-3 py-1 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-full shadow-sm uppercase">
                      {property.type}
                    </span>
                    {property.status === 'sold' && (
                      <span className="px-3 py-1 bg-red-500 text-white text-[10px] font-bold rounded-full shadow-sm uppercase">
                        SOLD
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleWishlist(property.id); }}
                    className={cn(
                      "absolute top-4 right-4 p-2 rounded-full shadow-lg transition-all",
                      wishlistIds.includes(property.id) 
                        ? "bg-red-500 text-white" 
                        : "bg-white/90 dark:bg-neutral-900/90 text-neutral-400 hover:text-red-500"
                    )}
                  >
                    <Heart className={cn("w-5 h-5", wishlistIds.includes(property.id) && "fill-current")} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleCompare(property.id); }}
                    className={cn(
                      "absolute top-16 right-4 p-2 rounded-full shadow-lg transition-all",
                      compareIds.includes(property.id) 
                        ? "bg-indigo-600 text-white" 
                        : "bg-white/90 dark:bg-neutral-900/90 text-neutral-400 hover:text-indigo-600"
                    )}
                    title="Compare Property"
                  >
                    <Building2 className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-4 right-4">
                    <div className="px-4 py-2 bg-navy text-gold font-bold rounded-xl shadow-lg border border-gold/20">
                      ${property.price.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-neutral-900 dark:text-white group-hover:text-indigo-600 transition-colors mb-2 truncate">
                    {property.title}
                  </h3>
                  <div className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400 text-sm mb-6">
                    <MapPin className="w-4 h-4" />
                    <span>{property.city}, {property.country}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 py-4 border-y border-neutral-100 dark:border-neutral-800 mb-6">
                    <div className="flex flex-col items-center gap-1">
                      <Bed className="w-5 h-5 text-neutral-400" />
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">{property.bedrooms} Beds</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 border-x border-neutral-100 dark:border-neutral-800">
                      <Bath className="w-5 h-5 text-neutral-400" />
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">{property.bathrooms} Baths</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <Maximize className="w-5 h-5 text-neutral-400" />
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">{property.sqft} Sqft</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(property.createdAt)}</span>
                    </div>
                    <button 
                      onClick={() => openDetails(property)}
                      className="flex items-center gap-1 text-gold font-bold text-sm hover:gap-2 transition-all"
                    >
                      {t('common.search')}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {hasMore && (
            <div className="mt-16 text-center">
              <button
                onClick={() => setDisplayLimit(prev => prev + PAGE_SIZE)}
                disabled={loadingMore}
                className="px-12 py-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white font-bold rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all shadow-sm flex items-center gap-2 mx-auto disabled:opacity-50"
              >
                {loadingMore ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Load More Properties'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-32 bg-white dark:bg-neutral-900 rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-800">
          <Home className="w-16 h-16 text-neutral-300 mx-auto mb-6" />
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">No properties found</h3>
          <p className="text-neutral-500 text-lg">Try adjusting your filters or search criteria.</p>
          <button 
            onClick={clearFilters}
            className="mt-8 px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </>
  ) : (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {activeTab === 'documents' && (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
          <div className="p-8 border-b border-neutral-100 dark:border-neutral-800">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">My Property Documents</h3>
            <p className="text-neutral-500 text-sm mt-1">Access and download your agreements and paperwork.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-8 py-5">Property</th>
                  <th className="px-8 py-5">Agreement</th>
                  <th className="px-8 py-5">Paperwork</th>
                  <th className="px-8 py-5">Uploaded On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td className="px-8 py-6">
                      <span className="text-sm font-bold text-neutral-900 dark:text-white">{doc.propertyTitle}</span>
                    </td>
                    <td className="px-8 py-6">
                      {doc.agreementURL ? (
                        <a
                          href={doc.agreementURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-all"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </a>
                      ) : (
                        <span className="text-xs text-neutral-400 italic">Not available</span>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      {doc.paperworkURL ? (
                        <a
                          href={doc.paperworkURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-bold rounded-lg hover:bg-neutral-200 transition-all"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </a>
                      ) : (
                        <span className="text-xs text-neutral-400 italic">Not available</span>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm text-neutral-500">{formatDate(doc.createdAt)}</span>
                    </td>
                  </tr>
                ))}
                {documents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center">
                      <FileText className="w-16 h-16 text-neutral-200 mx-auto mb-4" />
                      <h4 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">No documents yet</h4>
                      <p className="text-neutral-500 text-sm">Your agent hasn't uploaded any documents for you yet.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'searches' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedSearches.map((search) => (
            <div key={search.id} className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-gold/10 rounded-2xl">
                  <Search className="w-6 h-6 text-gold" />
                </div>
                <button 
                  onClick={() => deleteSavedSearch(search.id)}
                  className="p-2 text-neutral-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h4 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">{search.name}</h4>
              <div className="space-y-2 mb-6">
                {Object.entries(search.filters).map(([key, value]) => value && (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-neutral-500 capitalize">{key}:</span>
                    <span className="text-neutral-900 dark:text-neutral-300 font-bold">{String(value)}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => applySavedSearch(search.filters)}
                className="w-full py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-gold hover:text-navy transition-all"
              >
                Apply Search
              </button>
            </div>
          ))}
          {savedSearches.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800">
              <Search className="w-16 h-16 text-neutral-200 mx-auto mb-4" />
              <h4 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">No saved searches</h4>
              <p className="text-neutral-500 text-sm">Save your filters to quickly find properties later.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div 
              key={alert.id} 
              className={cn(
                "bg-white dark:bg-neutral-900 p-6 rounded-3xl border transition-all flex flex-col md:flex-row gap-6",
                alert.read ? "border-neutral-200 dark:border-neutral-800" : "border-gold/50 shadow-lg shadow-gold/5"
              )}
            >
              {alert.propertyData && (
                <div className="w-full md:w-48 h-32 rounded-2xl overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800">
                  {alert.propertyData.image ? (
                    <img 
                      src={alert.propertyData.image} 
                      alt={alert.propertyData.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Home className="w-8 h-8 text-neutral-300" />
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {!alert.read && <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />}
                      <h4 className="font-bold text-neutral-900 dark:text-white">
                        {alert.type === 'new_listing' ? 'New Property Listed' : 'Alert'}
                      </h4>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
                      {alert.message}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!alert.read && (
                      <button 
                        onClick={() => markAlertAsRead(alert.id)}
                        className="p-2 text-gold hover:bg-gold/10 rounded-lg transition-colors"
                        title="Mark as read"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    )}
                    <button 
                      onClick={() => deleteAlert(alert.id)}
                      className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <Clock className="w-4 h-4" />
                    <span>{formatDate(alert.createdAt)}</span>
                  </div>
                  {alert.propertyId && (
                    <button
                      onClick={async () => {
                        const propDoc = await getDoc(doc(db, 'properties', alert.propertyId!));
                        if (propDoc.exists()) {
                          openDetails({ id: propDoc.id, ...propDoc.data() } as Property);
                        } else {
                          toast.error('Property no longer available');
                        }
                      }}
                      className="text-xs font-black text-gold uppercase tracking-widest hover:underline"
                    >
                      View Property Details
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="py-20 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800">
              <Bell className="w-16 h-16 text-neutral-200 mx-auto mb-4" />
              <h4 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">No alerts yet</h4>
              <p className="text-neutral-500 text-sm">We'll notify you when new properties match your interests.</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )}

      {/* Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedProperty && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-black/95 backdrop-blur-xl overflow-x-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="bg-white dark:bg-neutral-950 w-full max-w-5xl max-h-[95vh] overflow-y-auto overflow-x-hidden rounded-[32px] shadow-[0_0_50px_rgba(0,0,0,0.3)] border border-neutral-200 dark:border-neutral-800 relative scrollbar-hide"
            >
              {/* SECTION 1: Property Images (Slider) */}
              <div className="relative w-full aspect-[16/9] bg-neutral-100 dark:bg-neutral-900 overflow-hidden group">
                <div className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                  {reimaginedImages[selectedProperty.id] ? (
                    <div className="min-w-full h-full snap-center relative">
                      <img 
                        src={reimaginedImages[selectedProperty.id]}
                        className="w-full h-full object-cover"
                        alt={`${selectedProperty.title} - Reimagined`}
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-6 left-6 px-4 py-2 bg-gold text-navy font-black text-[10px] uppercase tracking-widest rounded-full shadow-2xl animate-pulse">
                        AI Reimagined: {selectedStagingStyle}
                      </div>
                      <button 
                        onClick={() => setReimaginedImages(prev => {
                          const next = { ...prev };
                          delete next[selectedProperty.id];
                          return next;
                        })}
                        className="absolute top-6 right-20 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-2xl rounded-full text-white transition-all border border-white/20 shadow-lg"
                      >
                        <Clock className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    (selectedProperty.images?.length ? selectedProperty.images : [
                      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1000&auto=format&fit=crop',
                      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1000&auto=format&fit=crop',
                      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1000&auto=format&fit=crop'
                    ]).map((img, i) => (
                      <div key={i} className="min-w-full h-full snap-center relative">
                        <img 
                          src={img}
                          className="w-full h-full object-cover"
                          alt={`${selectedProperty.title} - ${i + 1}`}
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))
                  )}
                </div>
                
                {/* Overlay Controls */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
                
                <div className="absolute top-6 right-6 flex items-center gap-3 z-30">
                  <button 
                    onClick={() => setShowDetailsModal(false)}
                    className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-2xl rounded-full text-white transition-all border border-white/20 shadow-lg"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* AI Staging Controls */}
                <div className="absolute bottom-6 right-6 flex flex-col items-end gap-3 z-30">
                  <div className="flex bg-black/40 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 shadow-2xl">
                    {(['Modern Minimalist', 'Industrial', 'Boho', 'Luxury'] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() => setSelectedStagingStyle(style)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                          selectedStagingStyle === style 
                            ? "bg-gold text-navy shadow-lg" 
                            : "text-white/60 hover:text-white"
                        )}
                      >
                        {style.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={reimagineRoom}
                    disabled={isReimagining}
                    className="px-6 py-3 bg-gold text-navy font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:scale-105 transition-all flex items-center gap-3 disabled:opacity-50"
                  >
                    {isReimagining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Reimagine with AI
                  </button>
                </div>

                <div className="absolute bottom-6 left-6 flex gap-2 z-20">
                  <div className="px-3 py-1.5 bg-gold text-navy text-[10px] font-black uppercase tracking-[0.2em] rounded-lg shadow-lg">
                    {selectedProperty.type}
                  </div>
                  <div className="px-3 py-1.5 bg-white/10 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest rounded-lg border border-white/10">
                    {selectedProperty.images?.length || 1} Photos
                  </div>
                </div>
              </div>
              
              <div className="p-6 md:p-12 space-y-12">
                {/* SECTION 2: Basic Info */}
                <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
                  <div className="space-y-4 flex-1 w-full">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-500 rounded-full border border-green-500/20">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Active Listing</span>
                      </div>
                      {selectedProperty.status === 'sold' && (
                        <div className="px-3 py-1 bg-red-500/10 text-red-500 text-[10px] font-bold uppercase tracking-wider rounded-full border border-red-500/20">
                          Sold Out
                        </div>
                      )}
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black text-neutral-900 dark:text-white leading-[1.1] tracking-tight break-words">
                      {selectedProperty.title}
                    </h2>
                    <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                      <div className="p-2 bg-gold/10 rounded-lg">
                        <MapPin className="w-5 h-5 text-gold" />
                      </div>
                      <span className="text-lg md:text-xl font-medium">{selectedProperty.area}, {selectedProperty.city}, {selectedProperty.country}</span>
                    </div>
                  </div>
                  
                  <div className="w-full lg:w-auto">
                    <div className="p-8 bg-gold/5 dark:bg-gold/10 rounded-[32px] border border-gold/20 flex flex-col items-center lg:items-end justify-center min-w-[240px] relative overflow-hidden group">
                      <div className="absolute -top-4 -right-4 w-24 h-24 bg-gold/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                      <span className="text-[11px] font-black text-gold/60 uppercase tracking-[0.3em] mb-2 relative z-10">Asking Price</span>
                      <div className="text-4xl md:text-5xl font-black text-gold relative z-10">
                        ${selectedProperty.price.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: Features Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  {[
                    { icon: Bed, label: 'Bedrooms', value: selectedProperty.bedrooms, suffix: 'Beds' },
                    { icon: Bath, label: 'Bathrooms', value: selectedProperty.bathrooms, suffix: 'Baths' },
                    { icon: Maximize2, label: 'Total Area', value: selectedProperty.sqft, suffix: 'sqft' },
                    { icon: Home, label: 'Property Status', value: selectedProperty.status, suffix: '', capitalize: true }
                  ].map((feature, idx) => (
                    <div key={idx} className="p-6 bg-neutral-50 dark:bg-neutral-900/50 rounded-3xl border border-neutral-100 dark:border-neutral-800 flex flex-col items-center justify-center text-center transition-all hover:border-gold/30 hover:shadow-xl group">
                      <div className="p-3 bg-white dark:bg-neutral-800 rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                        <feature.icon className="w-6 h-6 text-gold" />
                      </div>
                      <span className="text-[10px] text-neutral-400 uppercase font-black tracking-[0.2em] mb-1">{feature.label}</span>
                      <div className="flex items-baseline gap-1">
                        <span className={cn("text-xl font-black text-neutral-900 dark:text-white", feature.capitalize && "capitalize")}>
                          {feature.value}
                        </span>
                        <span className="text-xs font-bold text-neutral-400">{feature.suffix}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* SECTION 4: Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {selectedProperty.virtualTourURL && (
                    <button 
                      onClick={() => setShowTourModal(true)}
                      className="w-full py-5 bg-navy text-gold font-black rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest shadow-xl border border-gold/10 active:scale-[0.98]"
                    >
                      <Maximize2 className="w-5 h-5" />
                      Virtual Tour
                    </button>
                  )}
                  <button 
                    onClick={() => setShowAppointmentModal(true)}
                    className="w-full py-5 bg-navy text-gold font-black rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest shadow-xl border border-gold/10 active:scale-[0.98]"
                  >
                    <Clock className="w-5 h-5" />
                    Book Viewing
                  </button>
                  <button 
                    onClick={startChat}
                    disabled={isStartingChat}
                    className="w-full py-5 bg-transparent text-gold border-2 border-gold/30 font-black rounded-2xl hover:bg-gold/5 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest active:scale-[0.98]"
                  >
                    {isStartingChat ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
                    Chat Agent
                  </button>
                  <button 
                    onClick={handleBuyProperty}
                    disabled={isBuying || selectedProperty.status === 'sold'}
                    className="w-full py-5 bg-gold text-navy font-black rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest shadow-xl active:scale-[0.98] disabled:opacity-50"
                  >
                    {isBuying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Tag className="w-5 h-5" />}
                    {selectedProperty.status === 'sold' ? 'Sold Out' : 'Buy Now'}
                  </button>
                </div>

                {/* Main Content Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 pt-12 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="lg:col-span-2 space-y-12">
                    {/* Description */}
                    <div className="space-y-6">
                      <h3 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">Property Overview</h3>
                      <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed font-medium">
                        {selectedProperty.description}
                      </p>
                    </div>

                    {/* AI Insights Bento */}
                    <div className="grid grid-cols-1 gap-6">
                      {/* AI Analysis Card */}
                      <div className="px-5 py-4 bg-neutral-900 rounded-[12px] border border-gold/20 shadow-2xl relative overflow-hidden group w-full">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                          <Sparkles className="w-32 h-32 text-gold" />
                        </div>
                        <div className="relative z-10 space-y-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-gold/10 rounded-xl">
                                <Sparkles className="w-5 h-5 text-gold" />
                              </div>
                              <h4 className="font-black text-white uppercase tracking-widest text-sm">AI Analysis</h4>
                            </div>
                            {!analysisResults[selectedProperty.id] && !isAnalyzing && (
                              <button onClick={analyzeProperty} className="text-[10px] font-black text-gold uppercase tracking-widest hover:underline">Run AI</button>
                            )}
                          </div>

                          {isAnalyzing ? (
                            <div className="flex flex-col items-center justify-center py-4">
                              <Loader2 className="w-8 h-8 text-gold animate-spin mb-2" />
                              <p className="text-[10px] font-black text-gold/60 uppercase tracking-widest animate-pulse">Scanning Market...</p>
                            </div>
                          ) : analysisResults[selectedProperty.id] ? (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Growth</span>
                                <span className="text-lg font-black text-white">{analysisResults[selectedProperty.id].growthPrediction}</span>
                              </div>
                              <p className="text-xs text-neutral-400 leading-relaxed italic font-medium">
                                "{analysisResults[selectedProperty.id].reasoning}"
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-neutral-500 italic">Predict future value and investment risks instantly.</p>
                          )}
                        </div>
                      </div>

                      {/* Neighborhood Card */}
                      <div className="px-5 py-4 bg-indigo-600/5 dark:bg-indigo-600/10 rounded-[12px] border border-indigo-600/20 shadow-2xl relative overflow-hidden group w-full">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                          <Globe className="w-32 h-32 text-indigo-600" />
                        </div>
                        <div className="relative z-10 space-y-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-indigo-600/10 rounded-xl">
                                <Globe className="w-5 h-5 text-indigo-600" />
                              </div>
                              <h4 className="font-black text-neutral-900 dark:text-white uppercase tracking-widest text-sm">Neighborhood</h4>
                            </div>
                            {!neighborhoodInsightsMap[selectedProperty.id] && !isAnalyzingNeighborhood && (
                              <button onClick={analyzeNeighborhood} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">Explore</button>
                            )}
                          </div>

                          {isAnalyzingNeighborhood ? (
                            <div className="flex flex-col items-center justify-center py-4">
                              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
                              <p className="text-[10px] font-black text-indigo-600/60 uppercase tracking-widest animate-pulse">Mapping Area...</p>
                            </div>
                          ) : neighborhoodInsightsMap[selectedProperty.id] ? (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between p-3 bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-800">
                                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Safety</span>
                                <span className="text-lg font-black text-indigo-600">{neighborhoodInsightsMap[selectedProperty.id].safetyScore}</span>
                              </div>
                              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed font-medium">
                                {neighborhoodInsightsMap[selectedProperty.id].vibe}
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-neutral-500 italic">Get local insights on schools, transit, and safety.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Market Analysis Section */}
                    <div className="p-8 bg-white dark:bg-neutral-900 rounded-[40px] border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-8">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-gold/10 rounded-2xl">
                            <TrendingUpIcon className="w-6 h-6 text-gold" />
                          </div>
                          <div>
                            <h3 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">Market Context</h3>
                            <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">12-Month Price History</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-gold" />
                            <span className="text-[10px] font-black text-neutral-400 uppercase">Property</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-indigo-600" />
                            <span className="text-[10px] font-black text-neutral-400 uppercase">Neighborhood</span>
                          </div>
                        </div>
                      </div>

                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={generateMarketData(selectedProperty.price)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#262626" : "#e5e5e5"} />
                            <XAxis 
                              dataKey="month" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{fontSize: 10, fill: isDark ? '#737373' : '#9ca3af', fontWeight: 700}}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{fontSize: 10, fill: isDark ? '#737373' : '#9ca3af', fontWeight: 700}}
                              tickFormatter={(val) => `$${val/1000}k`}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: isDark ? '#171717' : '#ffffff', 
                                border: isDark ? '1px solid #262626' : '1px solid #e5e5e5', 
                                borderRadius: '16px',
                                color: isDark ? '#fff' : '#000',
                                fontSize: '12px',
                                fontWeight: 700,
                                padding: '12px'
                              }}
                              itemStyle={{ color: isDark ? '#fff' : '#000' }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="property" 
                              stroke="#D4AF37" 
                              strokeWidth={4} 
                              dot={{ r: 4, fill: '#D4AF37', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="neighborhood" 
                              stroke="#4f46e5" 
                              strokeWidth={4} 
                              dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                        <div className="p-6 bg-neutral-50 dark:bg-neutral-800/50 rounded-3xl border border-neutral-100 dark:border-neutral-700">
                          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Market Status</span>
                          <span className="text-lg font-black text-green-500 flex items-center gap-2">
                            <TrendingUpIcon className="w-4 h-4" />
                            Bullish
                          </span>
                        </div>
                        <div className="p-6 bg-neutral-50 dark:bg-neutral-800/50 rounded-3xl border border-neutral-100 dark:border-neutral-700">
                          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Price/Sqft Avg</span>
                          <span className="text-lg font-black text-neutral-900 dark:text-white">
                            ${Math.round(selectedProperty.price / selectedProperty.sqft).toLocaleString()}
                          </span>
                        </div>
                        <div className="p-6 bg-neutral-50 dark:bg-neutral-800/50 rounded-3xl border border-neutral-100 dark:border-neutral-700">
                          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Demand Level</span>
                          <span className="text-lg font-black text-indigo-600">High</span>
                        </div>
                      </div>
                    </div>

                    {/* Reviews Section */}
                    <div className="space-y-8">
                      <div className="flex justify-between items-center">
                        <h3 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">Reviews</h3>
                        <button 
                          onClick={() => setShowReviewModal(true)}
                          className="px-6 py-3 bg-gold text-navy text-xs font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all shadow-lg"
                        >
                          Write Review
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {propertyReviews.length > 0 ? propertyReviews.map(review => (
                          <div key={review.id} className="p-6 bg-neutral-50 dark:bg-neutral-900/30 rounded-[32px] border border-neutral-100 dark:border-neutral-800">
                            <div className="flex justify-between items-center mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gold/10 rounded-full flex items-center justify-center text-gold font-black text-sm">
                                  {review.userName.charAt(0)}
                                </div>
                                <span className="font-black text-sm text-neutral-900 dark:text-white">{review.userName}</span>
                              </div>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map(s => (
                                  <Star key={s} className={cn("w-3.5 h-3.5", s <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-neutral-200 dark:text-neutral-700")} />
                                ))}
                              </div>
                            </div>
                            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed font-medium italic">
                              "{review.comment}"
                            </p>
                          </div>
                        )) : (
                          <div className="col-span-full py-12 mt-6 text-center bg-neutral-50 dark:bg-neutral-900/30 rounded-[32px] border border-dashed border-neutral-200 dark:border-neutral-800">
                            <MessageSquare className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                            <p className="text-neutral-500 font-bold">No reviews yet. Be the first to share!</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sticky Financials Column */}
                  <div className="space-y-8">
                    <div className="lg:sticky lg:top-8">
                      <MortgageCalculator 
                        price={selectedProperty.price} 
                        growthPrediction={analysisResults[selectedProperty.id]?.growthPrediction}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Appointment Modal */}
      <AnimatePresence>
        {showAppointmentModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">Schedule Viewing</h3>
              <form onSubmit={handleBookAppointment} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-neutral-400 uppercase tracking-wider mb-2">Select Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-gold dark:text-white"
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowAppointmentModal(false)}
                    className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isBooking}
                    className="flex-1 py-3 bg-navy text-gold font-bold rounded-xl disabled:opacity-50 border border-gold/20"
                  >
                    {isBooking ? 'Booking...' : 'Confirm'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Review Modal */}
      <AnimatePresence>
        {showReviewModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">Write a Review</h3>
              <form onSubmit={handleSubmitReview} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-neutral-400 uppercase tracking-wider mb-2">Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s)}
                        className="p-1"
                      >
                        <Star className={cn("w-8 h-8", s <= rating ? "fill-yellow-400 text-yellow-400" : "text-neutral-300")} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-400 uppercase tracking-wider mb-2">Comment</label>
                  <textarea
                    required
                    rows={4}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-gold dark:text-white resize-none"
                    placeholder="Share your thoughts about this property..."
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(false)}
                    className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="flex-1 py-3 bg-navy text-gold font-bold rounded-xl disabled:opacity-50 border border-gold/20"
                  >
                    {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Save Search Modal */}
      <AnimatePresence>
        {showSaveSearchModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-neutral-900 w-full max-w-md p-8 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800"
            >
              <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">Save Search</h3>
              <p className="text-neutral-500 text-sm mb-6">Give your search a name to save these filters.</p>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="e.g. Luxury Villas in Dubai"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-gold dark:text-white"
                />
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowSaveSearchModal(false)}
                    className="flex-1 py-3 text-sm font-bold text-neutral-500 hover:text-neutral-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSearch}
                    disabled={isSavingSearch || !searchName}
                    className="flex-1 py-3 bg-gold text-navy font-bold rounded-xl hover:bg-gold-hover transition-all disabled:opacity-50"
                  >
                    {isSavingSearch ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Search'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Comparison Bar */}
      <AnimatePresence>
        {compareIds.length > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[70] w-full max-w-2xl px-4"
          >
            <div className="bg-navy text-white p-4 rounded-2xl shadow-2xl border border-gold/30 flex items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-gold/20 rounded-lg">
                  <Building2 className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gold">Compare Properties</h4>
                  <p className="text-xs text-neutral-400">{compareIds.length} of 3 selected</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                  {compareIds.map(id => {
                    const p = properties.find(prop => prop.id === id);
                    return (
                      <div key={id} className="w-10 h-10 rounded-full border-2 border-navy overflow-hidden bg-neutral-800">
                        <img src={p?.images?.[0]} alt="" className="w-full h-full object-cover" />
                      </div>
                    );
                  })}
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCompareIds([])}
                    className="px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setShowCompareModal(true)}
                    disabled={compareIds.length < 2}
                    className="px-6 py-2 bg-gold text-navy font-extrabold rounded-xl hover:bg-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Compare Now
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comparison Modal */}
      <AnimatePresence>
        {showCompareModal && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-neutral-900 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800"
            >
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900 z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">Property Comparison</h3>
                </div>
                <button
                  onClick={() => setShowCompareModal(false)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr>
                        <th className="py-4 px-6 bg-neutral-50 dark:bg-neutral-800/50 text-xs font-bold text-neutral-400 uppercase tracking-wider rounded-tl-2xl">Feature</th>
                        {compareIds.map(id => {
                          const p = properties.find(prop => prop.id === id);
                          return (
                            <th key={id} className="py-4 px-6 bg-neutral-50 dark:bg-neutral-800/50 min-w-[250px]">
                              <div className="flex flex-col gap-2">
                                <div className="aspect-video rounded-xl overflow-hidden">
                                  <img src={p?.images?.[0]} alt="" className="w-full h-full object-cover" />
                                </div>
                                <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">{p?.title}</span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      <tr>
                        <td className="py-6 px-6 font-bold text-neutral-500 text-sm">Price</td>
                        {compareIds.map(id => (
                          <td key={id} className="py-6 px-6 font-extrabold text-gold text-lg">
                            ${properties.find(p => p.id === id)?.price.toLocaleString()}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-6 px-6 font-bold text-neutral-500 text-sm">Type</td>
                        {compareIds.map(id => (
                          <td key={id} className="py-6 px-6 text-sm text-neutral-900 dark:text-white capitalize">
                            {properties.find(p => p.id === id)?.type}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-6 px-6 font-bold text-neutral-500 text-sm">Bedrooms</td>
                        {compareIds.map(id => (
                          <td key={id} className="py-6 px-6 text-sm text-neutral-900 dark:text-white">
                            {properties.find(p => p.id === id)?.bedrooms} Beds
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-6 px-6 font-bold text-neutral-500 text-sm">Bathrooms</td>
                        {compareIds.map(id => (
                          <td key={id} className="py-6 px-6 text-sm text-neutral-900 dark:text-white">
                            {properties.find(p => p.id === id)?.bathrooms} Baths
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-6 px-6 font-bold text-neutral-500 text-sm">Area</td>
                        {compareIds.map(id => (
                          <td key={id} className="py-6 px-6 text-sm text-neutral-900 dark:text-white">
                            {properties.find(p => p.id === id)?.sqft.toLocaleString()} Sqft
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-6 px-6 font-bold text-neutral-500 text-sm">Location</td>
                        {compareIds.map(id => {
                          const p = properties.find(prop => prop.id === id);
                          return (
                            <td key={id} className="py-6 px-6 text-sm text-neutral-900 dark:text-white">
                              {p?.area}, {p?.city}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="py-6 px-6 font-bold text-neutral-500 text-sm">Growth Prediction</td>
                        {compareIds.map(id => (
                          <td key={id} className="py-6 px-6 text-sm font-bold text-gold">
                            {analysisResults[id]?.growthPrediction || 'N/A'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-6 px-6 font-bold text-neutral-500 text-sm">Neighborhood Vibe</td>
                        {compareIds.map(id => (
                          <td key={id} className="py-6 px-6 text-xs text-neutral-600 dark:text-neutral-400 italic">
                            {neighborhoodInsightsMap[id]?.vibe || 'N/A'}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <VirtualTourViewer
        isOpen={showTourModal}
        onClose={() => setShowTourModal(false)}
        url={selectedProperty?.virtualTourURL || ''}
        title={selectedProperty?.title || ''}
      />

      <AIAssistant 
        properties={properties} 
        savedSearches={savedSearches} 
        wishlistIds={wishlistIds} 
      />
    </div>
  );
};
